import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { readHistory, saveRows, storageBackend } from "@/lib/v5/store";
import { scanOpenSignals } from "@/lib/v5/live_outcomes";
import { sendOutcomeAlert, channelsConfigured } from "@/lib/telegram_v5";
import { bestPerformer, getStats } from "@/lib/v5/outcome_tracker";
import type { AlertStats } from "@/lib/telegram_v5";

/**
 * VISION MTF V5.6.8 — real-time TP/SL alerts.
 *
 * Polls the live tick for every open SIGNAL and broadcasts the moment TP1,
 * TP2 or SL is touched, instead of waiting for the hourly analysis run to
 * settle it from candles.
 *
 * Scheduling note: this CANNOT live in vercel.json. Vercel's Hobby plan
 * rejects any sub-daily cron and fails the entire deployment, not just the
 * schedule. It is driven by .github/workflows/check-outcomes.yml at GitHub's
 * 5-minute minimum instead.
 *
 * The hourly candle-based tracker still runs and remains authoritative: it
 * can see intrabar wicks a tick poll misses. This is the notification path.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset: open, so manual testing works
  const header = req.headers.get("authorization");
  if (header && safeEqual(header, `Bearer ${secret}`)) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q !== null && safeEqual(q, secret);
}

async function handle(req: Request) {
  const now = new Date();

  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const history = await readHistory();
  const { rows, hits, prices, open } = await scanOpenSignals(history.rows, now);

  // Stats are computed on the UPDATED rows, so a closing hit is already
  // counted and the alert can say "Updated: 50.0% WR". A TP1 leaves the trade
  // open, so it correctly reports the unchanged record.
  const statsAfter = getStats(rows);
  const best = bestPerformer(rows);
  const alertStats: AlertStats = {
    winRate: statsAfter.winRate,
    wins: statsAfter.wins,
    losses: statsAfter.losses,
    breakEven: statsAfter.breakEven,
    closed: statsAfter.closed,
    totalPips: statsAfter.totalPips,
    avgR: statsAfter.avgR,
    bestPair: best?.pair ?? null,
    bestWinRate: best?.winRate ?? null,
    bestSession: best?.bestSession ?? null,
  };

  const delivered: Record<string, unknown>[] = [];
  for (const hit of hits) {
    let res;
    try {
      res = await sendOutcomeAlert({
        pair: hit.row.pair,
        action: hit.row.action === "SELL" ? "SELL" : "BUY",
        kind: hit.kind,
        entry: hit.row.entry,
        level:
          hit.kind === "sl"
            ? (hit.row.sl ?? hit.price)
            : hit.kind === "tp1"
              ? (hit.row.tp1 ?? hit.price)
              : (hit.row.tp2 ?? hit.price),
        price: hit.price,
        pips: hit.pips,
        r: hit.row.outcome?.r ?? null,
        tp2: hit.row.tp2,
        stats: alertStats,
      });
    } catch (err) {
      // a delivery failure must never block the status write below
      console.error("[check-outcomes] alert failed:", (err as Error).message);
    }
    delivered.push({
      id: hit.row.id,
      pair: hit.row.pair,
      kind: hit.kind,
      pips: hit.pips,
      closes: hit.closes,
      delivered_public: res?.deliveredPublic ?? false,
      delivered_vip: res?.deliveredVip ?? false,
    });
  }

  // Persist regardless: statuses and the alert log must survive even when
  // Telegram is down, or the next poll would re-announce the same hit.
  const changed = rows !== history.rows;
  const saved = changed ? await saveRows(rows) : history;

  return NextResponse.json({
    ok: true,
    version: "5.6.8",
    ranAt: now.toISOString(),
    storage: storageBackend(),
    channels: channelsConfigured(),
    open_signals: open,
    prices,
    hits: delivered,
    stats: getStats(saved.rows),
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
