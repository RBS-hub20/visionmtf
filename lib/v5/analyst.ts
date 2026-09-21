import Anthropic from "@anthropic-ai/sdk";
import { loadChartSet } from "./charts";
import { formatPrice, type Spot } from "./market_data";
import {
  TFS,
  breakdownTotal,
  normalizeBreakdown,
  sessionForDate,
  type Action,
  type Analysis,
  type Pair,
  type Session,
} from "./types";

/** The SMC prop-trader system prompt, applied to the five chart images. */
export const VISION_PROMPT = `You are SMC Prop Trader, London Fix specialist, 10 years XAUUSD + BTC.
Analyze 5 chart IMAGES top-down (W, D, 4H, 1H, 15M).
WEEKLY/DAILY: Ano trend? Bullish/Bearish/Range? Aligned ba? May BOS/CHoCH?
4H/1H: Nasa Discount ba o Premium? May valid OB o FVG ba na hinohold? May liquidity sweep?
15M: May BOS or ChoCH ba para entry?
Rules:
   1. Kung W at D hindi aligned = WAIT agad
   2. XAUUSD: Focus London Fix 10:30am GMT and NY Open 8am EST. SL 80-150 pips
   3. BTC: 24/7, ATR-based SL, 92%+ confidence only
   4. BUY only sa Discount, SELL only sa Premium
Scoring: W 25, D 25, 4H 20, H1 15, 15M 15 = 100
Output JSON ONLY: {"pair":"XAUUSD","action":"BUY or SELL or WAIT","confidence":0-100,"score_breakdown":{"W":0-25,"D":0-25,"4H":0-20,"H1":0-15,"15M":0-15},"reason_taglish":"2 sentences Taglish","session":"London/NY/Asian","sl":null,"tp1":null,"tp2":null}`;

/**
 * NOTE ON MODEL CHOICE
 * The spec asked for `claude-3-5-sonnet-20241022`. That model was RETIRED on
 * 2025-10-28 and every request to it now fails, which would have made this
 * integration fall back to mock output permanently. `claude-sonnet-5` is the
 * documented successor in the same tier and is cheaper ($2/$10 per MTok).
 * Override with ANTHROPIC_VISION_MODEL if you need a different one.
 */
export const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL ?? "claude-sonnet-5";

/**
 * Sonnet 5 rejects `temperature` / `top_p` / `top_k` and `thinking.budget_tokens`
 * with a 400 — do not add them. Thinking runs adaptively by default; `effort: low`
 * keeps it shallow, which is what this hourly job wants for cost.
 */
const MAX_TOKENS = 2000;

export type AnalysisOutcome = {
  analysis: Analysis;
  mock: boolean;
  charts: number;
  live: boolean;
  spot: Spot | null;
  note?: string;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Pull the first balanced JSON object out of a text response. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through — the model may have wrapped it in prose or a fence
  }
  const start = trimmed.indexOf("{");
  if (start === -1) return {};
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1));
        } catch {
          return {};
        }
      }
    }
  }
  return {};
}

/** Coerce whatever the model returned into a valid Analysis. */
export function coerceAnalysis(raw: unknown, pair: Pair, now: Date): Analysis {
  const o = (raw ?? {}) as Record<string, unknown>;

  const actionRaw = String(o.action ?? "WAIT").toUpperCase();
  const action: Action =
    actionRaw === "BUY" || actionRaw === "SELL" ? (actionRaw as Action) : "WAIT";

  const breakdown = normalizeBreakdown(o.score_breakdown);

  // Trust the breakdown over a free-floating confidence number: they must agree.
  const total = breakdownTotal(breakdown);
  const stated = num(o.confidence);
  const confidence =
    stated !== null && Math.abs(stated - total) <= 5
      ? Math.max(0, Math.min(100, Math.round(stated)))
      : total;

  const sessionRaw = String(o.session ?? "");
  const session: Session = (["London", "NY", "Asian"] as const).includes(
    sessionRaw as Session
  )
    ? (sessionRaw as Session)
    : sessionForDate(now);

  const reason =
    typeof o.reason_taglish === "string" && o.reason_taglish.trim()
      ? o.reason_taglish.trim()
      : "Walang malinaw na setup sa ngayon. Hinihintay pa ang confluence bago pumasok.";

  return {
    pair,
    action,
    confidence,
    score_breakdown: breakdown,
    reason_taglish: reason,
    session,
    sl: action === "WAIT" ? null : num(o.sl),
    tp1: action === "WAIT" ? null : num(o.tp1),
    tp2: action === "WAIT" ? null : num(o.tp2),
  };
}

/**
 * Deterministic stand-in used when ANTHROPIC_API_KEY is absent or the call
 * fails, so the cron route and /live always return well-formed data.
 */
export function mockAnalysis(pair: Pair, now: Date): Analysis {
  const base =
    pair === "XAUUSD"
      ? { W: 22, D: 21, "4H": 14, H1: 7, "15M": 4 }
      : { W: 23, D: 22, "4H": 15, H1: 10, "15M": 4 };
  const breakdown = normalizeBreakdown(base);
  return {
    pair,
    action: "WAIT",
    confidence: breakdownTotal(breakdown),
    score_breakdown: breakdown,
    reason_taglish:
      pair === "XAUUSD"
        ? "Aligned pa rin ang Weekly at Daily sa bullish, pero nasa Premium pa ang price kaya hindi pa tayo papasok. Hinihintay natin ang tap sa 4H discount OB bago mag-execute sa 15M BOS."
        : "Malinis ang Daily trend pero hindi pa nafi-fill ang 1H FVG kaya wala pang entry. Kailangan muna ng 15M break of structure bago i-arm ang trade.",
    session: sessionForDate(now),
    sl: null,
    tp1: null,
    tp2: null,
  };
}

/** Send the five chart images to Claude and parse the JSON verdict. */
export async function analysePair(
  pair: Pair,
  now = new Date()
): Promise<AnalysisOutcome> {
  const set = await loadChartSet(pair);
  const charts = set.charts;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const base = { charts: charts.length, live: set.live, spot: set.spot };

  if (!apiKey) {
    return {
      ...base,
      analysis: mockAnalysis(pair, now),
      mock: true,
      note: "ANTHROPIC_API_KEY not set — returning mock analysis",
    };
  }
  if (charts.length === 0) {
    return {
      ...base,
      analysis: mockAnalysis(pair, now),
      mock: true,
      note: "no candles from any feed and no cached chart images",
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const content: Anthropic.ContentBlockParam[] = [
      {
        type: "text",
        text: [
          `Pair: ${pair}.`,
          set.spot
            ? `Current live price: ${pair} ${formatPrice(pair, set.spot.price)} (${set.spot.source}). Use THIS price for SL/TP calculation — do not read entry levels off the chart axis.`
            : `Live price unavailable — derive levels from the most recent candle close shown on the charts.`,
          `Candle source: ${set.source}.`,
          `Images follow in order: ${TFS.join(", ")}.`,
          `Current UTC time: ${now.toISOString()}.`,
          `Return JSON only.`,
        ].join(" "),
      },
      ...charts.map(
        (c): Anthropic.ContentBlockParam => ({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: c.buffer.toString("base64"),
          },
        })
      ),
    ];

    const res = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: MAX_TOKENS,
      system: VISION_PROMPT,
      output_config: { effort: "low" },
      messages: [{ role: "user", content }],
    });

    if (res.stop_reason === "refusal") {
      return {
        ...base,
        analysis: mockAnalysis(pair, now),
        mock: true,
        note: `model declined (${res.stop_details?.category ?? "unknown"}) — using mock`,
      };
    }

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!text.trim()) {
      return {
        ...base,
        analysis: mockAnalysis(pair, now),
        mock: true,
        note: `empty response (stop_reason: ${res.stop_reason}) — using mock`,
      };
    }

    return {
      ...base,
      analysis: coerceAnalysis(extractJson(text), pair, now),
      mock: false,
    };
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError
        ? `${err.status} ${err.message}`
        : (err as Error).message;
    console.error(`[v5/analyst] ${pair} Claude call failed:`, message);
    return {
      ...base,
      analysis: mockAnalysis(pair, now),
      mock: true,
      note: `Claude call failed, using mock: ${message}`,
    };
  }
}
