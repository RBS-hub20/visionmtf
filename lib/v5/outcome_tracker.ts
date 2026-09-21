import { fetchCandles, fetchSpot, type Candle } from "./market_data";
import {
  toPips,
  type Outcome,
  type Pair,
  type Session,
  type Tf,
  type TradeRecord,
  type TradeStatus,
} from "./types";

/**
 * VISION MTF V5.4 — automatic outcome verification.
 *
 * A signal is settled by replaying the candles that printed AFTER it was
 * published and finding the first touch of SL or TP1.
 *
 * Why candles and not just the current price: a spot check only sees where
 * price is right now, so a target that was tapped and reversed between two
 * hourly cron runs would never be recorded. On an hourly schedule that would
 * quietly under-report wins, which is the opposite of what a trust dashboard
 * is for. The live price is still used as a fallback when no candles come
 * back, and to settle expired trades at market.
 *
 * Conservative convention: if one candle's range spans BOTH the stop and the
 * target, it is scored as a LOSS. Without tick data there is no way to know
 * which came first, so we assume the worse of the two.
 */

/** A position left open this long is settled at market. */
export const EXPIRY_HOURS = 72;

/** Settled within this many pips of entry counts as break-even. */
const BE_BAND_PIPS = 5;

/** Pick a timeframe whose ~100-candle window covers the trade's age. */
function timeframeForAge(ageMs: number): Tf {
  const hours = ageMs / 3_600_000;
  if (hours <= 20) return "15M";
  if (hours <= 90) return "H1";
  return "D";
}

function buildOutcome(
  row: TradeRecord,
  closePrice: number,
  closedAt: string,
  via: Outcome["via"]
): Outcome {
  const entry = row.entry ?? closePrice;
  const dir = row.action === "SELL" ? -1 : 1;
  const dollars = (closePrice - entry) * dir;
  const risk = row.sl !== null ? Math.abs(entry - row.sl) : 0;
  return {
    pips: toPips(row.pair, dollars),
    dollars: Math.round(dollars * 100) / 100,
    r: risk > 0 ? Math.round((dollars / risk) * 100) / 100 : 0,
    closePrice: Math.round(closePrice * 100) / 100,
    closedAt,
    via,
  };
}

function classify(pair: Pair, outcome: Outcome, via: Outcome["via"]): TradeStatus {
  if (via === "tp1") return "WIN";
  if (via === "sl") return "LOSS";
  if (Math.abs(outcome.pips) <= BE_BAND_PIPS) return "BE";
  return outcome.pips > 0 ? "WIN" : "LOSS";
}

export type CheckResult = {
  status: TradeStatus;
  outcome: Outcome | null;
  checked: boolean;
  note?: string;
};

/**
 * Settle one pending signal. Returns PENDING unchanged when neither level has
 * been touched and the trade has not expired.
 */
export async function checkOutcome(
  row: TradeRecord,
  now = new Date()
): Promise<CheckResult> {
  if (row.type !== "SIGNAL" || row.status !== "PENDING") {
    return { status: row.status, outcome: row.outcome, checked: false };
  }
  if (row.action === "WAIT" || row.entry === null || row.sl === null || row.tp1 === null) {
    return {
      status: row.status,
      outcome: null,
      checked: false,
      note: "no levels to verify",
    };
  }

  const opened = Date.parse(row.timestamp);
  if (!Number.isFinite(opened)) {
    return { status: row.status, outcome: null, checked: false, note: "bad timestamp" };
  }
  const ageMs = now.getTime() - opened;

  const isBuy = row.action === "BUY";
  const sl = row.sl;
  const tp1 = row.tp1;

  let candles: Candle[] | null = null;
  try {
    candles = await fetchCandles(row.pair, timeframeForAge(ageMs));
  } catch {
    candles = null;
  }

  if (candles && candles.length) {
    for (const c of candles) {
      if (c.t < opened) continue; // only bars printed after publication
      const hitSl = isBuy ? c.l <= sl : c.h >= sl;
      const hitTp = isBuy ? c.h >= tp1 : c.l <= tp1;

      // Both in one bar: assume the stop went first.
      if (hitSl) {
        const o = buildOutcome(row, sl, new Date(c.t).toISOString(), "sl");
        return { status: "LOSS", outcome: o, checked: true };
      }
      if (hitTp) {
        const o = buildOutcome(row, tp1, new Date(c.t).toISOString(), "tp1");
        return { status: "WIN", outcome: o, checked: true };
      }
    }
  }

  // Nothing touched. Expire old positions at market so they do not sit
  // PENDING forever and skew the dashboard.
  if (ageMs > EXPIRY_HOURS * 3_600_000) {
    const spot = await fetchSpot(row.pair);
    const close = spot?.price ?? candles?.[candles.length - 1]?.c ?? null;
    if (close !== null) {
      const o = buildOutcome(row, close, now.toISOString(), "manual");
      return { status: classify(row.pair, o, "manual"), outcome: o, checked: true };
    }
  }

  return {
    status: "PENDING",
    outcome: null,
    checked: true,
    ...(candles ? {} : { note: "no candles available" }),
  };
}

/**
 * Settle up to `limit` pending signals, newest first.
 * Mutates nothing — returns a new array.
 */
export async function settlePending(
  rows: TradeRecord[],
  limit = 15,
  now = new Date()
): Promise<{ rows: TradeRecord[]; settled: number; checked: number }> {
  const pendingIds = rows
    .filter((r) => r.type === "SIGNAL" && r.status === "PENDING")
    .slice(0, limit)
    .map((r) => r.id);

  if (pendingIds.length === 0) return { rows, settled: 0, checked: 0 };

  const byId = new Map<string, CheckResult>();
  await Promise.all(
    pendingIds.map(async (id) => {
      const row = rows.find((r) => r.id === id)!;
      byId.set(id, await checkOutcome(row, now));
    })
  );

  let settled = 0;
  let checked = 0;
  const next = rows.map((r) => {
    const res = byId.get(r.id);
    if (!res) return r;
    if (res.checked) checked++;
    if (res.status === "PENDING") return r;
    settled++;
    return { ...r, status: res.status, outcome: res.outcome };
  });

  return { rows: next, settled, checked };
}

/* ------------------------------------------------------------------ */
/*  Aggregate stats                                                    */
/* ------------------------------------------------------------------ */

export type Stats = {
  closed: number;
  wins: number;
  losses: number;
  breakEven: number;
  pending: number;
  winRate: number;
  totalPips: number;
  avgR: number;
  bestPair: Pair | null;
  bestSession: Session | null;
  sampleSize: number;
};

/** Rolling stats over the last `sample` CLOSED signals. */
export function getStats(rows: TradeRecord[], sample = 30): Stats {
  const signals = rows.filter((r) => r.type === "SIGNAL");
  const closed = signals
    .filter((r) => r.status !== "PENDING" && r.outcome)
    .slice(0, sample);

  const wins = closed.filter((r) => r.status === "WIN").length;
  const losses = closed.filter((r) => r.status === "LOSS").length;
  const breakEven = closed.filter((r) => r.status === "BE").length;
  const pending = signals.filter((r) => r.status === "PENDING").length;

  const totalPips = closed.reduce((sum, r) => sum + (r.outcome?.pips ?? 0), 0);
  const avgR = closed.length
    ? closed.reduce((sum, r) => sum + (r.outcome?.r ?? 0), 0) / closed.length
    : 0;

  const bestBy = <K extends string>(key: (r: TradeRecord) => K | null): K | null => {
    const totals = new Map<K, number>();
    for (const r of closed) {
      const k = key(r);
      if (k === null) continue;
      totals.set(k, (totals.get(k) ?? 0) + (r.outcome?.pips ?? 0));
    }
    let best: K | null = null;
    let bestVal = -Infinity;
    totals.forEach((v, k) => {
      if (v > bestVal) {
        bestVal = v;
        best = k;
      }
    });
    return bestVal > 0 ? best : null;
  };

  return {
    closed: closed.length,
    wins,
    losses,
    breakEven,
    pending,
    winRate: closed.length ? Math.round((wins / closed.length) * 1000) / 10 : 0,
    totalPips: Math.round(totalPips * 10) / 10,
    avgR: Math.round(avgR * 100) / 100,
    bestPair: bestBy<Pair>((r) => r.pair),
    bestSession: bestBy<Session>((r) => r.session),
    sampleSize: sample,
  };
}
