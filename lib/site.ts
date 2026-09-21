/**
 * VISION MTF — single source of truth for copy, pricing and live-status data.
 * Edit here; every section reads from this file.
 */

export const site = {
  name: "VISION MTF",
  legalName: "GFXA TRADERS",
  sub: "MULTI TIMEFRAME TRADING",
  tagline: "The AI Prop Trader That Reads Like a Human",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://visionmtf.com",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? "#pricing",
  year: 2026,
} as const;

export const nav = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Live Status", href: "#live-status" },
  { label: "Pricing", href: "#pricing" },
] as const;

/* ------------------------------------------------------------------ */
/*  Timeframe stack — used by the hero visual and the How It Works flow */
/* ------------------------------------------------------------------ */

export type Timeframe = {
  key: string;
  label: string;
  role: string;
  read: string;
  state: "bullish" | "bearish" | "neutral";
  /** normalised 0-100 sparkline points */
  spark: number[];
};

export const timeframes: Timeframe[] = [
  {
    key: "W",
    label: "WEEKLY",
    role: "Macro trend",
    read: "BULLISH",
    state: "bullish",
    spark: [18, 22, 20, 31, 28, 42, 48, 45, 62, 70, 68, 82],
  },
  {
    key: "D",
    label: "DAILY",
    role: "Directional bias",
    read: "BULLISH",
    state: "bullish",
    spark: [24, 30, 27, 38, 46, 42, 55, 51, 64, 72, 78, 86],
  },
  {
    key: "4H",
    label: "4 HOUR",
    role: "Order block",
    read: "OB TAPPED",
    state: "bullish",
    spark: [70, 64, 58, 62, 44, 38, 30, 34, 48, 60, 66, 74],
  },
  {
    key: "1H",
    label: "1 HOUR",
    role: "Fair value gap",
    read: "FVG OPEN",
    state: "neutral",
    spark: [52, 60, 56, 68, 62, 50, 44, 52, 58, 54, 66, 71],
  },
  {
    key: "15M",
    label: "15 MIN",
    role: "Execution",
    read: "BOS CONFIRMED",
    state: "bullish",
    spark: [40, 36, 44, 38, 30, 34, 42, 56, 52, 68, 76, 88],
  },
];

/* ------------------------------------------------------------------ */
/*  Live AI status                                                      */
/* ------------------------------------------------------------------ */

export type AssetStatus = {
  symbol: string;
  name: string;
  state: "WAITING" | "EXECUTE" | "STAND DOWN";
  confidence: number;
  price: string;
  target: string;
  note: string;
  biases: { tf: string; state: "bullish" | "bearish" | "neutral" }[];
};

export const liveStatus: AssetStatus[] = [
  {
    symbol: "XAUUSD",
    name: "Gold / US Dollar",
    state: "WAITING",
    confidence: 68,
    price: "$2,655.40",
    target: "$2,635.00",
    note: "Price sitting in premium. Holding fire until the 4H discount order block is tapped.",
    biases: [
      { tf: "W", state: "bullish" },
      { tf: "D", state: "bullish" },
      { tf: "4H", state: "bullish" },
      { tf: "1H", state: "neutral" },
      { tf: "15M", state: "neutral" },
    ],
  },
  {
    symbol: "BTCUSD",
    name: "Bitcoin / US Dollar",
    state: "WAITING",
    confidence: 74,
    price: "$67,420",
    target: "$65,800",
    note: "Daily trend intact. 1H FVG unfilled — needs a 15M break of structure to arm the entry.",
    biases: [
      { tf: "W", state: "bullish" },
      { tf: "D", state: "bullish" },
      { tf: "4H", state: "neutral" },
      { tf: "1H", state: "bullish" },
      { tf: "15M", state: "neutral" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Pricing                                                             */
/* ------------------------------------------------------------------ */

export type Plan = {
  id: string;
  name: string;
  price: number;
  blurb: string;
  href: string;
  popular?: boolean;
  features: { text: string; included: boolean }[];
  cta: string;
};

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 79,
    blurb: "Gold only. Everything you need to trade one pair properly.",
    href: process.env.NEXT_PUBLIC_STRIPE_STARTER_URL ?? "#",
    cta: "Start with Gold",
    features: [
      { text: "XAUUSD signals", included: true },
      { text: "Full 5-timeframe MTF breakdown", included: true },
      { text: "WAIT alerts with reasoning", included: true },
      { text: "Entry, SL, TP + RR on every call", included: true },
      { text: "Telegram private channel", included: true },
      { text: "BTCUSD signals", included: false },
      { text: "MT5 Expert Advisor", included: false },
      { text: "Intraday scalp engine", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    popular: true,
    blurb: "Both markets plus the MT5 EA that executes while you sleep.",
    href: process.env.NEXT_PUBLIC_STRIPE_PRO_URL ?? "#",
    cta: "Get Pro Access",
    features: [
      { text: "XAUUSD + BTCUSD signals", included: true },
      { text: "Full 5-timeframe MTF breakdown", included: true },
      { text: "WAIT alerts with reasoning", included: true },
      { text: "MT5 Expert Advisor (auto-execution)", included: true },
      { text: "Risk-managed lot sizing", included: true },
      { text: "Live AI status dashboard", included: true },
      { text: "Intraday scalp engine", included: false },
      { text: "Weekly performance report", included: false },
    ],
  },
  {
    id: "funded",
    name: "Funded",
    price: 299,
    blurb: "Built for prop-firm challenges and funded accounts under drawdown rules.",
    href: process.env.NEXT_PUBLIC_STRIPE_FUNDED_URL ?? "#",
    cta: "Go Funded",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Intraday scalp engine", included: true },
      { text: "Weekly performance report (PDF)", included: true },
      { text: "Prop-firm drawdown guard rails", included: true },
      { text: "Challenge-phase risk presets", included: true },
      { text: "Priority signal delivery", included: true },
      { text: "Direct line to the desk", included: true },
      { text: "Session-based filters (London / NY)", included: true },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Trust strip                                                         */
/* ------------------------------------------------------------------ */

export const stats = [
  { value: "5", label: "Timeframes read per signal" },
  { value: "85%+", label: "Minimum confidence to fire" },
  { value: "2", label: "Markets: XAUUSD & BTCUSD" },
  { value: "24/5", label: "Continuous market scan" },
];

export const marquee = [
  "WEEKLY TREND",
  "DAILY BIAS",
  "PREMIUM / DISCOUNT",
  "ORDER BLOCKS",
  "FAIR VALUE GAPS",
  "BREAK OF STRUCTURE",
  "LIQUIDITY SWEEPS",
  "SESSION FILTERS",
  "RISK / REWARD",
];
