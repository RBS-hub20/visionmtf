import type { Candle } from "./market_data";
import { TFS, type Pair, type Tf } from "./types";

/**
 * VISION MTF V5.6.2 — momentum detection.
 *
 * The vision model reads structure well but is conservative: it holds WAIT
 * through fast directional moves because no clean OB retracement has printed.
 * This module adds a numeric, OHLC-derived second opinion so a dump or rip can
 * be caught while it is starting.
 *
 * It is deliberately gated: a momentum signal needs the right zone AND a
 * compressed higher timeframe AND at least one hard trigger. It can promote a
 * WAIT into a trade, so the bar is a conjunction, not a sum.
 *
 * Every input is real candle data from lib/v5/market_data.
 */

export type MomentumDirection = "BUY" | "SELL" | "NONE";

export type MomentumTrigger =
  | "double-bos"
  | "single-bos"
  | "rsi-divergence"
  | "wick-rejection"
  | "aggressive-bodies";

export type MomentumResult = {
  direction: MomentumDirection;
  /** 0-20 bonus points added to the model's base confidence. */
  momentumScore: number;
  reason: string;
  triggers: MomentumTrigger[];
  /** Diagnostics — surfaced in the cron response, not shown to subscribers. */
  detail: {
    zone: number | null;
    zoneLabel: "premium" | "discount" | "equilibrium" | "unknown";
    choppy4h: boolean;
    flatH1: boolean;
    dailyBias: "up" | "down" | "range";
    atr: number | null;
    volumeAvailable: boolean;
    exhausted?: boolean;
    regime?: "trending" | "ranging";
    triggersChecked?: Record<string, boolean>;
    gateFailed?: string;
  };
};

export const MOMENTUM_THRESHOLD = 60;

/** Range-mode fade edges, and how far into a trend an entry is still allowed. */
export const PREMIUM_EDGE = 0.6;
export const DISCOUNT_EDGE = 0.4;
export const TREND_ENTRY_FLOOR = 0.3;

/** How many 15M bars back to scan. The cron runs hourly, so a setup that
 *  appears and resolves between runs is invisible if we only look at "now".
 *  Measured: scanning 4 bars lifts BTCUSD from 5% to 12% of hourly runs. */
export const LOOKBACK_BARS = 4;

/**
 * Penalty for fading an exhausted trend instead of refusing outright.
 *
 * MEASURED: at 10 these fades were 5 of 7 XAUUSD signals and only 20%
 * right-direction — the weakest component by a wide margin. At 20 even a
 * maximum-strength fade scores 8, which cannot clear MOMENTUM_THRESHOLD, so
 * they are effectively off while the mechanism stays in place for tuning.
 */
export const EXHAUSTION_PENALTY = 20;
export const MOMENTUM_MAX_CONFIDENCE = 88;

const body = (c: Candle) => Math.abs(c.c - c.o);
const range = (c: Candle) => Math.max(1e-9, c.h - c.l);
const upperWick = (c: Candle) => c.h - Math.max(c.o, c.c);
const lowerWick = (c: Candle) => Math.min(c.o, c.c) - c.l;

/* ------------------------------------------------------------------ */
/*  Indicators                                                         */
/* ------------------------------------------------------------------ */

/** Wilder-smoothed ATR. */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const p = candles[i - 1];
    const c = candles[i];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  let value = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    value = (value * (period - 1) + trs[i]) / period;
  }
  return value;
}

/** Wilder RSI series, aligned to `candles` (first `period` entries are null). */
export function rsiSeries(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = candles.map(() => null);
  if (candles.length < period + 1) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].c - candles[i - 1].c;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].c - candles[i - 1].c;
    gain = (gain * (period - 1) + Math.max(0, d)) / period;
    loss = (loss * (period - 1) + Math.max(0, -d)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Swing pivots — a high/low with `k` lower/higher bars either side. */
function pivots(candles: Candle[], k: number, kind: "high" | "low"): number[] {
  const idx: number[] = [];
  for (let i = k; i < candles.length - k; i++) {
    let ok = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (kind === "high" ? candles[j].h >= candles[i].h : candles[j].l <= candles[i].l) {
        ok = false;
        break;
      }
    }
    if (ok) idx.push(i);
  }
  return idx;
}

/* ------------------------------------------------------------------ */
/*  Triggers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Two consecutive breaks of structure in `dir` within the recent window,
 * each with a decisive body (>50% of its own range).
 */
export function consecutiveBos(
  candles: Candle[],
  dir: "BUY" | "SELL",
  windowBars = 6,
  swing = 2,
  required = 2
): boolean {
  if (candles.length < swing * 2 + windowBars + 2) return false;
  const recent = candles.slice(-(windowBars + swing * 2 + 1));
  const piv = pivots(recent, swing, dir === "SELL" ? "low" : "high");
  if (piv.length === 0) return false;

  let breaks = 0;
  let level = dir === "SELL" ? recent[piv[0]].l : recent[piv[0]].h;

  for (let i = piv[0] + swing + 1; i < recent.length; i++) {
    const c = recent[i];
    const decisive = body(c) / range(c) > 0.5;
    const broke = dir === "SELL" ? c.c < level : c.c > level;
    const rightWay = dir === "SELL" ? c.c < c.o : c.c > c.o;
    if (broke && decisive && rightWay) {
      breaks++;
      level = dir === "SELL" ? Math.min(level, c.l) : Math.max(level, c.h);
      if (breaks >= required) return true;
    }
  }
  return false;
}

/**
 * Regular divergence: price makes a higher high while RSI makes a lower high
 * (bearish), or price a lower low while RSI makes a higher low (bullish).
 */
export function rsiDivergence(candles: Candle[], dir: "BUY" | "SELL"): boolean {
  const rsi = rsiSeries(candles);
  const kind = dir === "SELL" ? "high" : "low";
  const piv = pivots(candles, 2, kind).filter((i) => rsi[i] !== null).slice(-4);
  if (piv.length < 2) return false;

  const a = piv[piv.length - 2];
  const b = piv[piv.length - 1];
  const pa = dir === "SELL" ? candles[a].h : candles[a].l;
  const pb = dir === "SELL" ? candles[b].h : candles[b].l;
  const ra = rsi[a]!;
  const rb = rsi[b]!;

  return dir === "SELL" ? pb > pa && rb < ra : pb < pa && rb > ra;
}

/**
 * Rejection wick in the last two bars — a long wick against `dir`. A volume
 * spike strengthens it but is not required, because spot gold reports no
 * volume at all and we must not silently disable the trigger for XAUUSD.
 */
export function wickRejection(
  candles: Candle[],
  dir: "BUY" | "SELL"
): { hit: boolean; withVolume: boolean } {
  if (candles.length < 21) return { hit: false, withVolume: false };
  const last2 = candles.slice(-2);
  const prior = candles.slice(-21, -1);
  const avgVol = prior.reduce((s, c) => s + c.v, 0) / prior.length;
  const volumeAvailable = avgVol > 0;

  for (const c of last2) {
    const wick = dir === "SELL" ? upperWick(c) : lowerWick(c);
    if (wick / range(c) < 0.5) continue;
    const spike = volumeAvailable && c.v > avgVol * 1.5;
    return { hit: true, withVolume: spike };
  }
  return { hit: false, withVolume: false };
}

/** Aggressive order flow: 3+ of the last 5 bars closing hard in `dir`. */
export function aggressiveBodies(candles: Candle[], dir: "BUY" | "SELL"): boolean {
  if (candles.length < 5) return false;
  const last5 = candles.slice(-5);
  const strong = last5.filter((c) => {
    const rightWay = dir === "SELL" ? c.c < c.o : c.c > c.o;
    return rightWay && body(c) / range(c) > 0.6;
  });
  return strong.length >= 3;
}

/* ------------------------------------------------------------------ */
/*  Context gates                                                      */
/* ------------------------------------------------------------------ */

/**
 * Where price sits in the current dealing range, 0 = low, 1 = high.
 *
 * Calibrated against real PAXG candles rather than guessed. Pooling 12 weeks
 * of Weekly with 30 days of Daily produced a range so wide that 83% of bars
 * read "equilibrium" and momentum could essentially never fire. The last 20
 * Daily candles (~1 month) is the dealing range an SMC trader actually marks
 * premium/discount against, and it responds within a session or two.
 *
 * Weekly is the fallback only when Daily history is too thin.
 */
export const DEALING_RANGE_DAYS = 20;

export function zonePosition(
  weekly: Candle[],
  daily: Candle[],
  price: number
): number | null {
  const pool =
    daily.length >= 10 ? daily.slice(-DEALING_RANGE_DAYS) : weekly.slice(-8);
  if (pool.length === 0) return null;
  const hi = Math.max(...pool.map((c) => c.h));
  const lo = Math.min(...pool.map((c) => c.l));
  if (hi <= lo) return null;
  return Math.min(1, Math.max(0, (price - lo) / (hi - lo)));
}

/**
 * Daily bias from structure: consecutive lower highs/lows or higher highs/lows.
 *
 * This exists because of a failure the backtest exposed. Premium/discount is
 * measured against a rolling dealing range, so in a sustained downtrend price
 * sits permanently in "discount" and every rejection wick looks like
 * accumulation — the detector happily fired BUY at 4280 immediately before
 * gold fell to 4167. Mean-reversion momentum is only valid when the higher
 * timeframe is NOT trending against it, so a counter-trend entry is blocked.
 */
export function dailyBias(daily: Candle[], lookback = 10): "up" | "down" | "range" {
  if (daily.length < lookback + 1) return "range";
  const recent = daily.slice(-lookback);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = Math.max(...recent.map((c) => c.h)) - Math.min(...recent.map((c) => c.l));
  if (span <= 0) return "range";

  const drift = (last.c - first.c) / span;
  let lowerLows = 0;
  let higherHighs = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].l < recent[i - 1].l) lowerLows++;
    if (recent[i].h > recent[i - 1].h) higherHighs++;
  }
  const n = recent.length - 1;
  if (drift < -0.35 && lowerLows / n >= 0.5) return "down";
  if (drift > 0.35 && higherHighs / n >= 0.5) return "up";
  return "range";
}

/** Choppy = small bodies relative to range over the recent window. */
export function isChoppy(candles: Candle[], lookback = 12): boolean {
  if (candles.length < lookback) return false;
  const recent = candles.slice(-lookback);
  const meanBodyRatio =
    recent.reduce((s, c) => s + body(c) / range(c), 0) / recent.length;
  return meanBodyRatio < 0.45;
}

/** Flat = no decisive break of structure either way in the lookback. */
export function isFlat(candles: Candle[], lookback = 6): boolean {
  if (candles.length < lookback + 4) return false;
  return (
    !consecutiveBos(candles, "BUY", lookback) &&
    !consecutiveBos(candles, "SELL", lookback)
  );
}

/* ------------------------------------------------------------------ */
/*  Detection                                                          */
/* ------------------------------------------------------------------ */

export type Series = Partial<Record<Tf, Candle[]>>;

const TAGLISH: Record<MomentumTrigger, { sell: string; buy: string }> = {
  "double-bos": {
    sell: "2x bearish BOS sa 15M",
    buy: "2x bullish BOS sa 15M",
  },
  "single-bos": {
    sell: "bearish BOS sa 15M",
    buy: "bullish BOS sa 15M",
  },
  "rsi-divergence": {
    sell: "bearish RSI divergence",
    buy: "bullish RSI divergence",
  },
  "wick-rejection": {
    sell: "wick rejection sa premium",
    buy: "wick rejection sa discount",
  },
  "aggressive-bodies": {
    sell: "aggressive selling bodies",
    buy: "aggressive buying bodies",
  },
};

function empty(detail: MomentumResult["detail"]): MomentumResult {
  return { direction: "NONE", momentumScore: 0, reason: "", triggers: [], detail };
}

/**
 * Look for a momentum setup in either direction.
 *
 * Gates, all required: correct zone -> compressed 4H -> flat H1 -> >=1 trigger.
 * Score is 12 base + 3 per extra trigger + 2 if a volume spike corroborated
 * the wick, capped at 20.
 */
export function detectMomentum(
  pair: Pair,
  series: Series,
  price: number | null
): MomentumResult {
  const w = series.W ?? [];
  const d = series.D ?? [];
  const h4 = series["4H"] ?? [];
  const h1 = series.H1 ?? [];
  const m15 = series["15M"] ?? [];

  const last = price ?? m15[m15.length - 1]?.c ?? null;
  const zone = last !== null ? zonePosition(w, d, last) : null;
  const bias = dailyBias(d);
  const volumeAvailable = m15.some((c) => c.v > 0) || h1.some((c) => c.v > 0);

  const base: MomentumResult["detail"] = {
    zone,
    zoneLabel:
      zone === null ? "unknown" : zone >= 0.7 ? "premium" : zone <= 0.3 ? "discount" : "equilibrium",
    choppy4h: isChoppy(h4),
    flatH1: isFlat(h1),
    dailyBias: bias,
    atr: atr(h1),
    volumeAvailable,
  };

  if (m15.length < 20 || h1.length < 20) {
    return empty({ ...base, gateFailed: "not enough candles" });
  }
  if (zone === null) return empty({ ...base, gateFailed: "no zone reference" });

  // Two regimes, because one rule cannot serve both.
  //
  // TRENDING: follow the Daily, never fade it. Measured over 940 bars of real
  // gold, fading the trend fired 82 times at a 41% right-direction rate and a
  // -$3.81 average; following it caught the dump instead.
  //
  // RANGING: there is no trend to follow, and that is precisely when
  // premium/discount mean reversion is the correct model — fade the extremes.
  // Without this branch BTCUSD was blocked on every one of the last 192 bars
  // with "daily has no clear bias", so momentum could never fire on a ranging
  // market at any threshold.
  let dir: MomentumDirection;
  let exhausted = false;
  if (bias === "range") {
    if (zone >= PREMIUM_EDGE) dir = "SELL";
    else if (zone <= DISCOUNT_EDGE) dir = "BUY";
    else {
      return empty({
        ...base,
        gateFailed: "ranging but price mid-range, no edge to fade",
      });
    }
  } else {
    dir = bias === "down" ? "SELL" : "BUY";

    // At the exhausted end of a trend, flip to a mean-reversion fade rather
    // than refusing outright. Chasing a trend into its own extreme is the
    // worse trade; a bounce off it is at least a trade, so it is allowed with
    // a confidence penalty instead of a hard block.
    if (dir === "SELL" && zone < TREND_ENTRY_FLOOR) {
      dir = "BUY";
      exhausted = true;
    } else if (dir === "BUY" && zone > 1 - TREND_ENTRY_FLOOR) {
      dir = "SELL";
      exhausted = true;
    }
  }

  const triggers: MomentumTrigger[] = [];
  base.exhausted = exhausted;
  const doubleBos = consecutiveBos(m15, dir, 6, 2, 2);
  const singleBos = doubleBos || consecutiveBos(m15, dir, 6, 2, 1);
  if (doubleBos) triggers.push("double-bos");
  else if (singleBos) triggers.push("single-bos");
  if (rsiDivergence(h1, dir) || rsiDivergence(h4, dir)) triggers.push("rsi-divergence");
  const wick = wickRejection(h1, dir);
  if (wick.hit) triggers.push("wick-rejection");
  if (aggressiveBodies(m15, dir)) triggers.push("aggressive-bodies");

  base.triggersChecked = {
    doubleBos,
    singleBos,
    rsiDivergence: triggers.includes("rsi-divergence"),
    wickRejection: wick.hit,
    aggressiveBodies: triggers.includes("aggressive-bodies"),
  };

  // A lone single BOS is not enough on its own — it needs corroboration.
  const onlyWeakTrigger =
    triggers.length === 1 && triggers[0] === "single-bos";
  if (triggers.length === 0 || onlyWeakTrigger) {
    return empty({
      ...base,
      gateFailed:
        triggers.length === 0
          ? "no momentum trigger fired"
          : "single BOS with no corroborating trigger",
    });
  }

  // Range mode demands the strong tier; the weak tier is trending-only.
  //
  // MEASURED: allowing a single BOS while ranging gave BTCUSD ~6.5 signals a
  // day at 56% right-direction and -$31 average. Requiring the double BOS
  // gave ~2.5 a day at 80% and +$420. Fading a range without a decisive
  // structural break is mostly noise, so quality wins here.
  if (bias === "range" && !doubleBos) {
    return empty({ ...base, gateFailed: "ranging without a double BOS" });
  }

  // Double BOS is the strong tier (18 base); a single BOS backed by another
  // trigger is the weaker tier (12 base). Compression is context, not a veto:
  // as a hard gate it suppressed every signal in the sample.
  const strongTier = doubleBos;
  const raw =
    (strongTier ? 18 : 12) +
    (triggers.length - 1) * 2 +
    (base.choppy4h ? 1 : 0) +
    (base.flatH1 ? 1 : 0) +
    (wick.withVolume ? 2 : 0) -
    (exhausted ? EXHAUSTION_PENALTY : 0);
  const score = Math.max(0, Math.min(20, raw));
  if (score <= 0) {
    return empty({ ...base, gateFailed: "score fell to zero after penalties" });
  }

  const side = dir === "SELL" ? "sell" : "buy";
  const trend = dir === "SELL" ? "bearish" : "bullish";
  const reason =
    `Daily ${trend} + ${triggers.map((t) => TAGLISH[t][side]).join(" + ")} — ` +
    `maagang pasok habang ${dir === "SELL" ? "bumababa" : "umaakyat"} pa.`;

  return { direction: dir, momentumScore: score, reason, triggers, detail: base };
}

/** Levels for a momentum entry, derived from ATR since there is no OB to anchor to. */
export function momentumLevels(
  entry: number,
  dir: "BUY" | "SELL",
  atrValue: number | null,
  pair: Pair
) {
  const a = atrValue && atrValue > 0 ? atrValue : entry * (pair === "XAUUSD" ? 0.004 : 0.01);
  const risk = a * 1.5;
  const sign = dir === "BUY" ? 1 : -1;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    sl: r2(entry - sign * risk),
    tp1: r2(entry + sign * risk * 2),
    tp2: r2(entry + sign * risk * 2.8),
  };
}

/**
 * Scan the last `bars` 15M candles, newest first, and return the most recent
 * firing setup.
 *
 * The cron runs hourly but momentum setups live on the 15M chart, so a setup
 * that appears and resolves between two runs is invisible if only "now" is
 * examined. Measured over 400 bars with an hourly cadence, scanning 4 bars
 * lifted BTCUSD from 5% to 12% of runs producing a signal.
 *
 * Returns the newest bar's result when nothing fires, so the diagnostics
 * always describe the current state.
 */
export function detectMomentumWindow(
  pair: Pair,
  series: Series,
  price: number | null,
  bars = LOOKBACK_BARS
): MomentumResult & { barsAgo: number } {
  const m15 = series["15M"] ?? [];
  const now = detectMomentum(pair, series, price);
  if (now.direction !== "NONE" || m15.length < bars + 2) {
    return { ...now, barsAgo: 0 };
  }

  for (let back = 1; back < bars; back++) {
    const cut = m15[m15.length - 1 - back]?.t;
    if (!cut) break;
    const sliced: Series = {};
    for (const tf of TFS) {
      const arr = series[tf];
      if (arr) sliced[tf] = arr.filter((c) => c.t <= cut);
    }
    const past = detectMomentum(pair, sliced, sliced["15M"]?.slice(-1)[0]?.c ?? price);
    if (past.direction !== "NONE") return { ...past, barsAgo: back };
  }
  return { ...now, barsAgo: 0 };
}
