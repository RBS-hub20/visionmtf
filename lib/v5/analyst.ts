import OpenAI from "openai";
import { loadCharts, toDataUrl } from "./charts";
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
export const VISION_PROMPT = `You are SMC Prop Trader, London Fix specialist.
Analyze 5 chart IMAGES top-down (W,D,4H,1H,15M).
WEEKLY/DAILY: Ano trend? Bullish/Bearish/Range? Aligned? BOS/CHoCH?
4H/1H: Nasa Discount/Premium? Valid OB/FVG hold? Liquidity sweep?
15M: BOS/ChoCH for entry?
Rules:
1. W and D not aligned = WAIT
2. XAUUSD: London Fix 10:30am GMT, NY Open 8am EST focus, SL 80-150 pips
3. BTC: 24/7, ATR SL, 92%+ confidence only
4. BUY only Discount, SELL only Premium
Scoring: W 25, D 25, 4H 20, H1 15, 15M 15 = 100
Output JSON ONLY: {"pair":"XAUUSD","action":"BUY/SELL/WAIT","confidence":0-100,"score_breakdown":{"W":0-25,"D":0-25,"4H":0-20,"H1":0-15,"15M":0-15},"reason_taglish":"2 sentences Taglish","session":"London/NY/Asian","sl":null,"tp1":null,"tp2":null}`;

export const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";

export type AnalysisOutcome = {
  analysis: Analysis;
  mock: boolean;
  charts: number;
  note?: string;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
 * Deterministic stand-in used when OPENAI_API_KEY is absent or the call fails,
 * so the cron route and /live always return well-formed data.
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

/** Send the five chart images to the vision model and parse the JSON reply. */
export async function analysePair(
  pair: Pair,
  now = new Date()
): Promise<AnalysisOutcome> {
  const charts = await loadCharts(pair);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      analysis: mockAnalysis(pair, now),
      mock: true,
      charts: charts.length,
      note: "OPENAI_API_KEY not set — returning mock analysis",
    };
  }
  if (charts.length === 0) {
    return {
      analysis: mockAnalysis(pair, now),
      mock: true,
      charts: 0,
      note: "no chart images in public/charts/latest — run scripts/mt5_factory.py",
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VISION_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Pair: ${pair}. Images follow in order: ${TFS.join(", ")}. Current UTC time: ${now.toISOString()}. Return JSON only.`,
            },
            ...charts.map((c) => ({
              type: "image_url" as const,
              image_url: { url: toDataUrl(c.buffer), detail: "high" as const },
            })),
          ],
        },
      ],
    });

    const text = res.choices[0]?.message?.content ?? "{}";
    return {
      analysis: coerceAnalysis(JSON.parse(text), pair, now),
      mock: false,
      charts: charts.length,
    };
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[v5/analyst] ${pair} vision call failed:`, message);
    return {
      analysis: mockAnalysis(pair, now),
      mock: true,
      charts: charts.length,
      note: `vision call failed, using mock: ${message}`,
    };
  }
}
