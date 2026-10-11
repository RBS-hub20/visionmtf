import { fetchSpot } from "./market_data";
import {
  PAIRS,
  toPips,
  type AlertKind,
  type Outcome,
  type Pair,
  type TradeRecord,
  type TradeStatus,
} from "./types";

/**
 * VISION MTF V5.6.8 — real-time TP/SL detection.
 *
 * The V5.4 tracker settles trades from candles on the hourly analysis run, so
 * a target tapped at 14:03 is only recorded at 15:00. This module polls the
 * live tick every few minutes purely to answer "has a level been touched yet",
 * and fires a Telegram alert the moment one is.
 *
 * It does not replace the candle-based tracker: that one still produces the
 * authoritative settle (it can see intrabar wicks this cannot). This is the
 * fast path for notifications.
 */

export type LevelHit = {
  row: TradeRecord;
  kind: AlertKind;
  price: number;
  /** Signed pips at the moment of the hit. */
  pips: number;
  /** True when this hit also closes the trade. */
  closes: boolean;
};

/** Which levels a live price has touched, newest state first. */
export function hitsFor(row: TradeRecord, price: number): AlertKind[] {
  if (row.action === "WAIT" || row.entry === null) return [];
  const long = row.action === "BUY";
  const out: AlertKind[] = [];

  // Stop first: if a single tick straddles both, assume the worse outcome,
  // matching the conservative convention the candle tracker already uses.
  if (row.sl !== null && (long ? price <= row.sl : price >= row.sl)) {
    return ["sl"];
  }
  if (row.tp1 !== null && (long ? price >= row.tp1 : price <= row.tp1)) {
    out.push("tp1");
  }
  if (row.tp2 !== null && (long ? price >= row.tp2 : price <= row.tp2)) {
    out.push("tp2");
  }
  return out;
}

function buildOutcome(
  row: TradeRecord,
  closePrice: number,
  at: string,
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
    closedAt: at,
    via,
  };
}

export function pipsAt(row: TradeRecord, price: number): number {
  const entry = row.entry ?? price;
  const dir = row.action === "SELL" ? -1 : 1;
  return toPips(row.pair, (price - entry) * dir);
}

export type ScanResult = {
  rows: TradeRecord[];
  hits: LevelHit[];
  prices: Partial<Record<Pair, number>>;
  open: number;
};

/**
 * Check every open SIGNAL against the live tick.
 *
 * Returns updated rows plus the hits that have NOT been alerted before — the
 * `alerts` log on each row makes a 5-minute poll idempotent, so a target that
 * stays breached for an hour still only notifies once.
 */
export async function scanOpenSignals(
  rows: TradeRecord[],
  now = new Date()
): Promise<ScanResult> {
  const open = rows.filter(
    (r) => r.type === "SIGNAL" && r.status === "PENDING" && r.action !== "WAIT"
  );
  if (open.length === 0) {
    return { rows, hits: [], prices: {}, open: 0 };
  }

  // One spot fetch per pair that actually has an open trade.
  const needed = Array.from(new Set(open.map((r) => r.pair))) as Pair[];
  const prices: Partial<Record<Pair, number>> = {};
  await Promise.all(
    needed.map(async (pair) => {
      const spot = await fetchSpot(pair).catch(() => null);
      if (spot) prices[pair] = spot.price;
    })
  );

  const stamp = now.toISOString();
  const hits: LevelHit[] = [];
  const byId = new Map<string, TradeRecord>();

  for (const row of open) {
    const price = prices[row.pair];
    if (price === undefined) continue;

    const touched = hitsFor(row, price);
    if (touched.length === 0) {
      // track the best excursion so a later alert can show the runner
      const p = pipsAt(row, price);
      if (p > 0 && (row.peak === undefined || price !== row.peak)) {
        const better =
          row.action === "BUY"
            ? Math.max(row.peak ?? -Infinity, price)
            : Math.min(row.peak ?? Infinity, price);
        if (better !== row.peak) byId.set(row.id, { ...row, peak: better });
      }
      continue;
    }

    const alerts = { ...(row.alerts ?? {}) };
    let next: TradeRecord = { ...row, alerts };
    let fired = false;

    for (const kind of touched) {
      if (alerts[kind]) continue; // already announced
      alerts[kind] = stamp;
      fired = true;

      const level = kind === "sl" ? row.sl! : kind === "tp1" ? row.tp1! : row.tp2!;
      const closes = kind !== "tp1";
      hits.push({
        row: next,
        kind,
        price,
        pips: pipsAt({ ...row, entry: row.entry }, level),
        closes,
      });

      if (closes) {
        const status: TradeStatus = kind === "sl" ? "LOSS" : "WIN";
        next = {
          ...next,
          alerts,
          status,
          outcome: buildOutcome(row, level, stamp, kind),
        };
      }
    }

    if (fired) byId.set(row.id, { ...next, alerts });
  }

  const updated = rows.map((r) => byId.get(r.id) ?? r);
  return { rows: updated, hits, prices, open: open.length };
}

export { PAIRS };
