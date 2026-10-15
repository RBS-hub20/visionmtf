import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { readHistory, storageBackend } from "@/lib/v5/store";
import { bestPerformer, getStats } from "@/lib/v5/outcome_tracker";
import {
  channelsConfigured,
  sendDailySummary,
  type AlertStats,
} from "@/lib/telegram_v5";

/**
 * VISION MTF V5.6.9 — daily summary.
 *
 * Posts the rolling record to the public channel once a day so the channel is
 * never silent, even through a stretch with no signals. Driven by
 * .github/workflows/daily-summary.yml at 04:00 UTC = 08:00 Dubai.
 *
 * Read-only: it never writes history or sends to VIP.
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
  if (!secret) return true;
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

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const history = await readHistory();
  const stats = getStats(history.rows);
  const best = bestPerformer(history.rows);

  const since = now.getTime() - 24 * 60 * 60 * 1000;
  const signalsLast24h = history.rows.filter(
    (r) => r.type === "SIGNAL" && Date.parse(r.timestamp) >= since
  ).length;

  const payload: AlertStats = {
    winRate: stats.winRate,
    wins: stats.wins,
    losses: stats.losses,
    breakEven: stats.breakEven,
    closed: stats.closed,
    totalPips: stats.totalPips,
    avgR: stats.avgR,
    bestPair: best?.pair ?? null,
    bestWinRate: best?.winRate ?? null,
    bestSession: best?.bestSession ?? null,
  };

  let res;
  if (!dry) {
    try {
      res = await sendDailySummary({
        stats: payload,
        signalsLast24h,
        rowsScanned: history.rows.length,
      });
    } catch (err) {
      console.error("[daily-summary] send failed:", (err as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    version: "5.6.9",
    dry,
    ranAt: now.toISOString(),
    storage: storageBackend(),
    channels: channelsConfigured(),
    signals_last_24h: signalsLast24h,
    rows_scanned: history.rows.length,
    stats: payload,
    delivered_public: res?.deliveredPublic ?? false,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
