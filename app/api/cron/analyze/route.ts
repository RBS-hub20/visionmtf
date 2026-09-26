import { NextResponse } from "next/server";
import { analysePair, VISION_MODEL } from "@/lib/v5/analyst";
import { appendRows, readHistory, saveRows, storageBackend } from "@/lib/v5/store";
import { getStats, settlePending } from "@/lib/v5/outcome_tracker";
import { lastFailures } from "@/lib/v5/market_data";
import { channelsConfigured, sendMarketWatch, sendSignal } from "@/lib/telegram_v5";
import {
  MIN_CHART_CONFIDENCE,
  evaluateChartGate,
  readBudget,
  type ChartGate,
} from "@/lib/v5/chart_budget";
import {
  PAIRS,
  SEND_THRESHOLD,
  type Analysis,
  type Pair,
  type TradeRecord,
} from "@/lib/v5/types";

/**
 * VISION MTF V5.6 — analysis cron (dual-channel, anti-spam, outcome tracking).
 *
 * Runs hourly (GitHub Actions; vercel.json keeps a daily Vercel Cron because
 * the Hobby plan rejects sub-daily schedules).
 *
 * Three outcomes per pair:
 *
 *   1. SIGNAL MODE      action != WAIT and confidence >= threshold
 *                       (XAUUSD 85, BTCUSD 90). Fires immediately, any hour,
 *                       and bypasses the chart budget entirely.
 *
 *   2. CHART UPDATE     MARKET WATCH post, capped at 10/day (one per 2.4h),
 *                       alternating pairs, skipped below 60 confidence.
 *
 *   3. QUIET MODE       analyse, persist, update /live — send nothing.
 *                       This is the common case.
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

type Evaluated = {
  pair: Pair;
  analysis: Analysis;
  mock: boolean;
  charts: number;
  live: boolean;
  spot: number | null;
  note?: string;
  tradable: boolean;
};

async function handle(req: Request) {
  const now = new Date();

  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ---- 1. analyse both pairs -------------------------------------------
  const evaluated: Evaluated[] = [];
  for (const pair of PAIRS as readonly Pair[]) {
    const { analysis, mock, charts, note, live, spot } = await analysePair(pair, now);
    evaluated.push({
      pair,
      analysis,
      mock,
      charts,
      live,
      spot: spot?.price ?? null,
      note,
      tradable:
        analysis.action !== "WAIT" && analysis.confidence >= SEND_THRESHOLD[pair],
    });
  }

  // ---- 2. decide, then act ---------------------------------------------
  // Read the budget and history once so both pairs see the same snapshot.
  const [budget, history] = await Promise.all([readBudget(), readHistory()]);

  // A pair only yields its turn if the other is genuinely a candidate,
  // otherwise one quiet pair would block the other indefinitely.
  const chartCandidates = evaluated.filter(
    (e) => !e.tradable && e.analysis.confidence >= MIN_CHART_CONFIDENCE
  );

  const records: TradeRecord[] = [];
  const report: Record<string, unknown>[] = [];
  let chartSlotTaken = false;

  for (const e of evaluated) {
    const { pair, analysis } = e;
    let delivered = false;
    let deliveredPublic = false;
    let deliveredVip = false;
    let mode = "QUIET";
    let detail: unknown = { reason: "no-send" };

    if (e.tradable) {
      // ---- SIGNAL MODE — PUBLIC + VIP, bypasses the chart budget ----
      mode = "SIGNAL";
      const res = await sendSignal(analysis, e.spot, SEND_THRESHOLD[pair]);
      delivered = res.ok;
      deliveredPublic = res.deliveredPublic;
      deliveredVip = res.deliveredVip;
      detail = res;
    } else {
      // ---- CHART UPDATE MODE — budgeted ----
      const otherEligible = chartCandidates.some((c) => c.pair !== pair);
      const gate: ChartGate = chartSlotTaken
        ? { allowed: false, reason: "slot-used-this-run" }
        : evaluateChartGate(
            pair,
            analysis.confidence,
            budget,
            now,
            otherEligible
          );

      if (gate.allowed) {
        // ---- CHART UPDATE — PUBLIC only, never VIP ----
        mode = "CHART_UPDATE";
        const res = await sendMarketWatch(analysis);
        delivered = res.ok;
        deliveredPublic = res.deliveredPublic;
        deliveredVip = false;
        detail = res;
        // one chart slot per run, even if both pairs qualify
        if (res.ok) chartSlotTaken = true;
      } else {
        detail = gate;
      }
    }

    // Every run records a row — WATCH rows prove the engine is awake even
    // when it has nothing to say.
    const isSignal = e.tradable;
    records.push({
      id: `${pair}-${now.getTime()}`,
      timestamp: now.toISOString(),
      pair,
      type: isSignal ? "SIGNAL" : "WATCH",
      action: analysis.action,
      entry: isSignal ? (e.spot ?? null) : null,
      sl: isSignal ? analysis.sl : null,
      tp1: isSignal ? analysis.tp1 : null,
      tp2: isSignal ? analysis.tp2 : null,
      confidence: analysis.confidence,
      session: analysis.session,
      score_breakdown: analysis.score_breakdown,
      reason_taglish: analysis.reason_taglish,
      chartUrl: `/api/collage?pair=${pair}&t=${now.getTime()}`,
      status: "PENDING",
      outcome: null,
      delivered,
      mock: e.mock,
    });

    report.push({
      pair,
      mode,
      action: analysis.action,
      confidence: analysis.confidence,
      threshold: SEND_THRESHOLD[pair],
      type: isSignal ? "SIGNAL" : "WATCH",
      delivered,
      delivered_public: deliveredPublic,
      delivered_vip: deliveredVip,
      detail,
      charts: e.charts,
      liveCandles: e.live,
      price: e.spot,
      mock: e.mock,
      ...(e.live ? {} : { feedErrors: lastFailures(pair) }),
      ...(e.note ? { note: e.note } : {}),
    });
  }

  // ---- 3. persist, then verify outstanding signals -------------------
  const appended = await appendRows(records, history.rows);
  const { rows, settled, checked } = await settlePending(appended.rows, 15, now);
  const saved = settled > 0 ? await saveRows(rows) : appended;
  const stats = getStats(saved.rows);

  return NextResponse.json({
    ok: true,
    version: "5.6",
    model: VISION_MODEL,
    ranAt: now.toISOString(),
    mock: records.every((r) => r.mock),
    chartBudget: {
      lastPost: budget.lastPost,
      lastPair: budget.lastPair,
      maxPerDay: 10,
      minConfidence: MIN_CHART_CONFIDENCE,
    },
    storage: storageBackend(),
    channels: channelsConfigured(),
    delivered_public: report.some((r) => r.delivered_public === true),
    delivered_vip: report.some((r) => r.delivered_vip === true),
    outcomes: { checked, settled },
    stats,
    results: report,
    stored: saved.rows.length,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
