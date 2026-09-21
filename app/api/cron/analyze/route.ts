import { NextResponse } from "next/server";
import { analysePair } from "@/lib/v5/analyst";
import { appendSignals, readSignals } from "@/lib/v5/store";
import { sendNoTradeUpdate, sendSignal } from "@/lib/telegram_v5";
import {
  PAIRS,
  SEND_THRESHOLD,
  WAIT_UPDATE_INTERVAL_MS,
  type Pair,
  type SignalKind,
  type SignalRecord,
  type SignalsFile,
} from "@/lib/v5/types";

/**
 * VISION MTF V5 — analysis cron.
 * Scheduled every 30 minutes by vercel.json.
 *
 * 1. Load the five chart images per pair from public/charts/latest
 * 2. Send them to the vision model top-down (W, D, 4H, H1, 15M)
 * 3. Persist the result to data/signals.json (see lib/v5/store for the
 *    read-only-filesystem caveat on Vercel)
 * 4. Broadcast: XAUUSD at >=85, BTCUSD at >=90; otherwise a WAIT update
 *    at most once every 2 hours per pair.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset: open, so manual testing works
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

function dueForWaitUpdate(last: string | undefined, now: Date) {
  if (!last) return true;
  const prev = Date.parse(last);
  if (!Number.isFinite(prev)) return true;
  return now.getTime() - prev >= WAIT_UPDATE_INTERVAL_MS;
}

async function handle(req: Request) {
  const now = new Date();

  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const existing = await readSignals();
  const records: SignalRecord[] = [];
  const waitStamps: SignalsFile["lastWaitUpdateAt"] = {};
  const report: Record<string, unknown>[] = [];

  for (const pair of PAIRS as readonly Pair[]) {
    const { analysis, mock, charts, note } = await analysePair(pair, now);
    const threshold = SEND_THRESHOLD[pair];

    const tradable = analysis.action !== "WAIT" && analysis.confidence >= threshold;
    const waitDue =
      !tradable && dueForWaitUpdate(existing.lastWaitUpdateAt[pair], now);

    let kind: SignalKind = "LOGGED";
    let delivered = false;
    let delivery: unknown = { skipped: "below-threshold" };

    if (tradable) {
      kind = "SIGNAL";
      const res = await sendSignal(analysis, null, threshold);
      delivered = res.ok;
      delivery = res;
    } else if (waitDue) {
      kind = "WAIT_UPDATE";
      const res = await sendNoTradeUpdate(analysis);
      delivered = res.ok;
      delivery = res;
      waitStamps[pair] = now.toISOString();
    }

    records.push({
      ...analysis,
      id: `${pair}-${now.getTime()}`,
      ts: now.toISOString(),
      price: null,
      kind,
      delivered,
      collage: null,
      mock,
    });

    report.push({
      pair,
      action: analysis.action,
      confidence: analysis.confidence,
      threshold,
      kind,
      delivered,
      delivery,
      charts,
      mock,
      ...(note ? { note } : {}),
    });
  }

  const saved = await appendSignals(records, waitStamps);

  return NextResponse.json({
    ok: true,
    version: 5,
    ranAt: now.toISOString(),
    mock: records.every((r) => r.mock),
    results: report,
    stored: saved.signals.length,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
