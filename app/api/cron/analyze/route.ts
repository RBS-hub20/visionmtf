import { NextResponse } from "next/server";
import { analysePair, VISION_MODEL } from "@/lib/v5/analyst";
import { appendSignals } from "@/lib/v5/store";
import { sendMarketWatch, sendSignal } from "@/lib/telegram_v5";
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
  type SignalKind,
  type SignalRecord,
} from "@/lib/v5/types";

/**
 * VISION MTF V5.2 — analysis cron (anti-spam).
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
    const { analysis, mock, charts, note } = await analysePair(pair, now);
    evaluated.push({
      pair,
      analysis,
      mock,
      charts,
      note,
      tradable:
        analysis.action !== "WAIT" && analysis.confidence >= SEND_THRESHOLD[pair],
    });
  }

  // ---- 2. decide, then act ---------------------------------------------
  // Read the budget once so both pairs are judged against the same snapshot.
  const budget = await readBudget();

  // A pair only yields its turn if the other is genuinely a candidate,
  // otherwise one quiet pair would block the other indefinitely.
  const chartCandidates = evaluated.filter(
    (e) => !e.tradable && e.analysis.confidence >= MIN_CHART_CONFIDENCE
  );

  const records: SignalRecord[] = [];
  const report: Record<string, unknown>[] = [];
  let chartSlotTaken = false;

  for (const e of evaluated) {
    const { pair, analysis } = e;
    let kind: SignalKind = "LOGGED";
    let delivered = false;
    let mode = "QUIET";
    let detail: unknown = { reason: "no-send" };

    if (e.tradable) {
      // ---- SIGNAL MODE — always fires, bypasses the chart budget ----
      mode = "SIGNAL";
      kind = "SIGNAL";
      const res = await sendSignal(analysis, null, SEND_THRESHOLD[pair]);
      delivered = res.ok;
      detail = res;
    } else {
      // ---- CHART UPDATE MODE — budgeted ----
      const otherEligible = chartCandidates.some((c) => c.pair !== pair);
      const gate: ChartGate = chartSlotTaken
        ? { allowed: false, reason: "not-this-pairs-turn", preferred: pair }
        : evaluateChartGate(
            pair,
            analysis.confidence,
            budget,
            now,
            otherEligible
          );

      if (gate.allowed) {
        mode = "CHART_UPDATE";
        kind = "WAIT_UPDATE";
        const res = await sendMarketWatch(analysis);
        delivered = res.ok;
        detail = res;
        // one chart slot per run, even if both pairs qualify
        if (res.ok) chartSlotTaken = true;
      } else {
        detail = gate;
      }
    }

    records.push({
      ...analysis,
      id: `${pair}-${now.getTime()}`,
      ts: now.toISOString(),
      price: null,
      kind,
      delivered,
      collage: null,
      mock: e.mock,
    });

    report.push({
      pair,
      mode,
      action: analysis.action,
      confidence: analysis.confidence,
      threshold: SEND_THRESHOLD[pair],
      kind,
      delivered,
      detail,
      charts: e.charts,
      mock: e.mock,
      ...(e.note ? { note: e.note } : {}),
    });
  }

  const saved = await appendSignals(records, {});

  return NextResponse.json({
    ok: true,
    version: "5.2",
    model: VISION_MODEL,
    ranAt: now.toISOString(),
    mock: records.every((r) => r.mock),
    chartBudget: {
      lastPost: budget.lastPost,
      lastPair: budget.lastPair,
      maxPerDay: 10,
      minConfidence: MIN_CHART_CONFIDENCE,
    },
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
