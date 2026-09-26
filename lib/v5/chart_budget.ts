import { promises as fs } from "fs";
import path from "path";
import { KV_KEYS, kvEnabled, kvGet, kvSet } from "./kv";
import type { Pair } from "./types";

/**
 * V5.2 anti-spam budget for low-priority chart posts.
 *
 * At most 10 MARKET WATCH posts per 24h => one every 2.4 hours. High-priority
 * SIGNALs bypass this entirely and can fire at any hour.
 *
 * Durable via Vercel KV (V5.6), so the cap is now a real global 10/day rather
 * than 10 per warm instance — a cold start no longer resets it. Falls back to
 * the local filesystem when KV is not configured, so dev works unchanged.
 */

export const CHART_POST_INTERVAL_MS = 8_640_000; // 2.4h => 10 posts / 24h
export const MIN_CHART_CONFIDENCE = 60; // below this the setup is not worth posting

const isServerless = Boolean(process.env.VERCEL);
const FILE = isServerless
  ? path.join("/tmp", "last_chart_post.json")
  : path.join(process.cwd(), "data", "last_chart_post.json");

export type ChartBudget = {
  lastPost: string | null;
  lastPair: Pair | null;
};

const EMPTY: ChartBudget = { lastPost: null, lastPair: null };

function normalise(raw: unknown): ChartBudget | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<ChartBudget>;
  return {
    lastPost: typeof b.lastPost === "string" ? b.lastPost : null,
    lastPair: b.lastPair ?? null,
  };
}

export async function readBudget(): Promise<ChartBudget> {
  if (kvEnabled()) {
    const fromKv = normalise(await kvGet<unknown>(KV_KEYS.chartBudget));
    if (fromKv) return fromKv;
  }
  try {
    return normalise(JSON.parse(await fs.readFile(FILE, "utf8"))) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function writeBudget(budget: ChartBudget): Promise<boolean> {
  const wroteKv = await kvSet(KV_KEYS.chartBudget, budget);
  let wroteFile = false;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(budget, null, 2), "utf8");
    wroteFile = true;
  } catch {
    // read-only filesystem outside /tmp on Vercel — expected
  }
  if (!wroteKv && !wroteFile) {
    console.error("[v5/chart_budget] write failed on every backend");
    return false;
  }
  return true;
}

export type ChartGate =
  | { allowed: true; reason: "due" }
  | { allowed: false; reason: "cooling-down"; nextEligible: string; waitMs: number }
  | { allowed: false; reason: "low-confidence" }
  | { allowed: false; reason: "not-this-pairs-turn"; preferred: Pair }
  /** The other pair already consumed this run's single slot. */
  | { allowed: false; reason: "slot-used-this-run" };

/**
 * Decide whether `pair` may take the next chart slot.
 *
 * Gates, in order:
 *   1. confidence must be >= 60 (skip ugly setups, save tokens and noise)
 *   2. at least 2.4h since the last chart post
 *   3. alternate pairs — whichever did NOT post last gets the slot
 */
export function evaluateChartGate(
  pair: Pair,
  confidence: number,
  budget: ChartBudget,
  now: Date,
  otherPairAlsoEligible: boolean
): ChartGate {
  if (confidence < MIN_CHART_CONFIDENCE) {
    return { allowed: false, reason: "low-confidence" };
  }

  if (budget.lastPost) {
    const elapsed = now.getTime() - Date.parse(budget.lastPost);
    if (Number.isFinite(elapsed) && elapsed < CHART_POST_INTERVAL_MS) {
      const waitMs = CHART_POST_INTERVAL_MS - elapsed;
      return {
        allowed: false,
        reason: "cooling-down",
        nextEligible: new Date(now.getTime() + waitMs).toISOString(),
        waitMs,
      };
    }
  }

  // Alternate pairs, but only when the other pair is actually a candidate —
  // otherwise a single eligible pair would starve waiting for its turn.
  const preferred: Pair = budget.lastPair === "XAUUSD" ? "BTCUSD" : "XAUUSD";
  if (otherPairAlsoEligible && pair !== preferred) {
    return { allowed: false, reason: "not-this-pairs-turn", preferred };
  }

  return { allowed: true, reason: "due" };
}

/** Convenience wrapper: reads the budget and evaluates the gate. */
export async function canPostChart(
  pair: Pair,
  confidence: number,
  now = new Date(),
  otherPairAlsoEligible = false
): Promise<ChartGate> {
  return evaluateChartGate(
    pair,
    confidence,
    await readBudget(),
    now,
    otherPairAlsoEligible
  );
}

/** Record that `pair` just consumed a chart slot. */
export async function recordChartPost(pair: Pair, now = new Date()) {
  await writeBudget({ lastPost: now.toISOString(), lastPair: pair });
}
