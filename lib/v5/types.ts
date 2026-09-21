/**
 * VISION MTF V5.0 — Vision AI Engine
 * Shared types for the chart-image analysis pipeline.
 */

export const PAIRS = ["XAUUSD", "BTCUSD"] as const;
export type Pair = (typeof PAIRS)[number];

/** Timeframe keys, in top-down analysis order. */
export const TFS = ["W", "D", "4H", "H1", "15M"] as const;
export type Tf = (typeof TFS)[number];

/**
 * Filename suffix per timeframe. scripts/mt5_factory.py writes MT5-style
 * names (H4, M15) while the model's JSON schema uses 4H / 15M.
 */
export const TF_FILE: Record<Tf, string> = {
  W: "W",
  D: "D",
  "4H": "H4",
  H1: "H1",
  "15M": "M15",
};

/** Max score each timeframe contributes. Sums to 100. */
export const TF_WEIGHT: Record<Tf, number> = {
  W: 25,
  D: 25,
  "4H": 20,
  H1: 15,
  "15M": 15,
};

/** Minimum confidence required before a signal is broadcast. */
export const SEND_THRESHOLD: Record<Pair, number> = {
  XAUUSD: 85,
  BTCUSD: 90,
};

/** How often a WAIT state is re-broadcast, in milliseconds. */
export const WAIT_UPDATE_INTERVAL_MS = 2 * 60 * 60 * 1000;

export type Action = "BUY" | "SELL" | "WAIT";
export type Session = "London" | "NY" | "Asian";

export type ScoreBreakdown = Record<Tf, number>;

/** Exactly the JSON shape the vision model is asked to return. */
export type Analysis = {
  pair: Pair;
  action: Action;
  confidence: number;
  score_breakdown: ScoreBreakdown;
  reason_taglish: string;
  session: Session;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
};

export type SignalKind = "SIGNAL" | "WAIT_UPDATE" | "LOGGED";

/** A stored analysis run, plus what the engine did with it. */
export type SignalRecord = Analysis & {
  id: string;
  ts: string;
  price: number | null;
  kind: SignalKind;
  delivered: boolean;
  collage: string | null;
  mock: boolean;
};

export type SignalsFile = {
  version: 5;
  updatedAt: string | null;
  lastWaitUpdateAt: Partial<Record<Pair, string>>;
  signals: SignalRecord[];
};

export const EMPTY_SIGNALS: SignalsFile = {
  version: 5,
  updatedAt: null,
  lastWaitUpdateAt: {},
  signals: [],
};

/** Clamp a model-supplied breakdown to the allowed per-timeframe maximums. */
export function normalizeBreakdown(raw: unknown): ScoreBreakdown {
  const out = {} as ScoreBreakdown;
  const src = (raw ?? {}) as Record<string, unknown>;
  for (const tf of TFS) {
    const n = Number(src[tf]);
    out[tf] = Number.isFinite(n) ? Math.max(0, Math.min(TF_WEIGHT[tf], Math.round(n))) : 0;
  }
  return out;
}

export function breakdownTotal(b: ScoreBreakdown): number {
  return TFS.reduce((sum, tf) => sum + (b[tf] ?? 0), 0);
}

/** Session derived from UTC hour — London fix and NY open drive XAUUSD. */
export function sessionForDate(d: Date): Session {
  const h = d.getUTCHours();
  if (h >= 7 && h < 13) return "London";
  if (h >= 13 && h < 21) return "NY";
  return "Asian";
}
