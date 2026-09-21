import { TFS, type Pair, type Tf } from "./types";

/**
 * VISION MTF V5.3 — live market data.
 *
 * BTCUSD : Binance public klines. All five intervals exist natively.
 * XAUUSD : Yahoo Finance COMEX gold futures (GC=F) for OHLC — Yahoo has no
 *          XAUUSD=X series — plus gold-api.com for the true XAU/USD spot used
 *          in the live-price overlay. Futures trade at a small premium to
 *          spot, so the panels are labelled with their real source.
 *          Set TWELVEDATA_API_KEY to use true spot OHLC instead.
 *
 * No API keys required for the defaults. All failures fall back to the
 * previous cached value, then to null — callers degrade to disk charts.
 */

export type Candle = {
  t: number; // epoch ms, candle open
  o: number;
  h: number;
  l: number;
  c: number;
};

export const BARS = 100;

/* ------------------------------------------------------------------ */
/*  Cache — per-timeframe TTL, warm-instance only                      */
/* ------------------------------------------------------------------ */

const TTL_MS: Record<Tf, number> = {
  W: 3 * 60 * 60 * 1000,
  D: 60 * 60 * 1000,
  "4H": 30 * 60 * 1000,
  H1: 15 * 60 * 1000,
  "15M": 5 * 60 * 1000,
};

type Entry<T> = { value: T; at: number };
const cache = new Map<string, Entry<unknown>>();

/** Last fetch error per pair, surfaced by the cron route for diagnosis. */
const failures = new Map<string, string>();

function recordFailure(pair: Pair, tf: Tf, message: string) {
  failures.set(`${pair}:${tf}`, message.slice(0, 200));
}

export function lastFailures(pair: Pair): string[] {
  const out: string[] = [];
  failures.forEach((msg, key) => {
    if (key.startsWith(`${pair}:`)) out.push(`${key} ${msg}`);
  });
  return out;
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T | null> {
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await load();
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[market_data] ${key} failed:`, message);
    failures.set(key, message.slice(0, 200));
    return hit ? hit.value : null; // stale beats nothing
  }
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": "Mozilla/5.0 (VISION-MTF)", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.split("?")[0]}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Binance — BTCUSD                                                   */
/* ------------------------------------------------------------------ */

/** Binance symbol per pair. PAXG is physically-backed gold, 1 token = 1 oz. */
const BINANCE_SYMBOL: Record<Pair, string> = {
  BTCUSD: "BTCUSDT",
  XAUUSD: "PAXGUSDT",
};

const BINANCE_INTERVAL: Record<Tf, string> = {
  W: "1w",
  D: "1d",
  "4H": "4h",
  H1: "1h",
  "15M": "15m",
};

/**
 * Binance geo-blocks several cloud regions (HTTP 451) — Vercel's iad1 is
 * AWS us-east-1 and is among them. data-api.binance.vision is Binance's
 * public market-data host and is not restricted; Yahoo is the last resort.
 */
const BINANCE_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
];

function parseKlines(rows: unknown[][]): Candle[] {
  return rows.map((r) => ({
    t: Number(r[0]),
    o: Number(r[1]),
    h: Number(r[2]),
    l: Number(r[3]),
    c: Number(r[4]),
  }));
}

async function fetchBinance(pair: Pair, tf: Tf): Promise<Candle[]> {
  const qs = `symbol=${BINANCE_SYMBOL[pair]}&interval=${BINANCE_INTERVAL[tf]}&limit=${BARS}`;
  const errors: string[] = [];

  for (const host of BINANCE_HOSTS) {
    try {
      const rows = (await getJson(`${host}/api/v3/klines?${qs}`)) as unknown[][];
      if (Array.isArray(rows) && rows.length > 1) return parseKlines(rows);
      errors.push(`${host}: empty`);
    } catch (err) {
      errors.push(`${host}: ${(err as Error).message}`);
    }
  }

  // Every Binance host refused — fall back to Yahoo.
  try {
    return await fetchYahoo(YAHOO_SYMBOL[pair], tf);
  } catch (err) {
    errors.push(`yahoo: ${(err as Error).message}`);
    throw new Error(errors.join(" | "));
  }
}

/* ------------------------------------------------------------------ */
/*  Yahoo Finance — XAUUSD via GC=F                                    */
/* ------------------------------------------------------------------ */

/** Yahoo has no native 4h, so 4H is aggregated from four 1h candles. */
const YAHOO_SPEC: Record<Tf, { interval: string; range: string; groupBy?: number }> = {
  W: { interval: "1wk", range: "2y" },
  D: { interval: "1d", range: "6mo" },
  "4H": { interval: "1h", range: "3mo", groupBy: 4 },
  H1: { interval: "1h", range: "1mo" },
  "15M": { interval: "15m", range: "5d" },
};

type YahooChart = {
  chart: {
    result:
      | {
          timestamp?: number[];
          meta?: { regularMarketPrice?: number };
          indicators: {
            quote: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[];
          };
        }[]
      | null;
    error?: { description?: string } | null;
  };
};

/** Collapse N consecutive candles into one, preserving true OHLC. */
function groupCandles(candles: Candle[], n: number): Candle[] {
  if (n <= 1) return candles;
  const bucketMs = n * 60 * 60 * 1000; // 1h source
  const buckets = new Map<number, Candle[]>();
  for (const c of candles) {
    const key = Math.floor(c.t / bucketMs) * bucketMs;
    const arr = buckets.get(key);
    if (arr) arr.push(c);
    else buckets.set(key, [c]);
  }
  const entries: [number, Candle[]][] = [];
  buckets.forEach((group, t) => entries.push([t, group]));
  entries.sort((a, b) => a[0] - b[0]);
  return entries.map(([t, group]) => ({
    t,
    o: group[0].o,
    h: Math.max(...group.map((g: Candle) => g.h)),
    l: Math.min(...group.map((g: Candle) => g.l)),
    c: group[group.length - 1].c,
  }));
}

async function fetchYahoo(symbol: string, tf: Tf): Promise<Candle[]> {
  const spec = YAHOO_SPEC[tf];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=${spec.interval}&range=${spec.range}`;
  const data = (await getJson(url)) as YahooChart;
  const result = data.chart.result?.[0];
  if (!result?.timestamp) {
    throw new Error(data.chart.error?.description ?? "no data");
  }
  const q = result.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    // Yahoo returns nulls for non-trading slots — drop them
    if (o == null || h == null || l == null || c == null) continue;
    out.push({ t: result.timestamp[i] * 1000, o, h, l, c });
  }
  const grouped = spec.groupBy ? groupCandles(out, spec.groupBy) : out;
  return grouped.slice(-BARS);
}

/* ------------------------------------------------------------------ */
/*  TwelveData — optional true XAU/USD spot OHLC                       */
/* ------------------------------------------------------------------ */

const TD_INTERVAL: Record<Tf, string> = {
  W: "1week",
  D: "1day",
  "4H": "4h",
  H1: "1h",
  "15M": "15min",
};

async function fetchTwelveData(tf: Tf, apiKey: string): Promise<Candle[]> {
  const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${TD_INTERVAL[tf]}&outputsize=${BARS}&apikey=${apiKey}`;
  const data = (await getJson(url)) as {
    status?: string;
    message?: string;
    values?: { datetime: string; open: string; high: string; low: string; close: string }[];
  };
  if (data.status === "error" || !data.values) {
    throw new Error(data.message ?? "twelvedata error");
  }
  return data.values
    .map((v) => ({
      t: Date.parse(v.datetime.includes("T") ? `${v.datetime}Z` : `${v.datetime.replace(" ", "T")}Z`),
      o: Number(v.open),
      h: Number(v.high),
      l: Number(v.low),
      c: Number(v.close),
    }))
    .reverse(); // TwelveData returns newest first
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function candleSourceLabel(pair: Pair): string {
  if (pair === "BTCUSD") return "Binance BTCUSDT";
  return process.env.TWELVEDATA_API_KEY ? "TwelveData XAU/USD" : "Binance PAXG (gold)";
}

/** Yahoo needs its own symbol per pair when used as the fallback. */
export const YAHOO_SYMBOL: Record<Pair, string> = {
  XAUUSD: "GC=F",
  BTCUSD: "BTC-USD",
};

export async function fetchCandles(pair: Pair, tf: Tf): Promise<Candle[] | null> {
  const td = process.env.TWELVEDATA_API_KEY;
  const key = `${pair}:${tf}:${pair === "XAUUSD" && td ? "td" : "def"}`;
  return cached(key, TTL_MS[tf], async () => {
    if (pair === "XAUUSD" && td) {
      try {
        return await fetchTwelveData(tf, td);
      } catch (err) {
        // A bad or rate-limited key must NOT sink the whole chain.
        recordFailure(pair, tf, `twelvedata: ${(err as Error).message}`);
      }
    }
    // Binance for BOTH pairs: Yahoo rate-limits datacenter IPs, so on Vercel
    // it fails persistently. PAXG tracks spot to ~0.1%, far closer than COMEX
    // GC=F futures, and has all five intervals natively.
    return fetchBinance(pair, tf);
  });
}

/** All five timeframes for a pair, fetched in parallel. */
export async function fetchAllCandles(
  pair: Pair
): Promise<{ tf: Tf; candles: Candle[] }[]> {
  const results = await Promise.all(
    TFS.map(async (tf) => ({ tf, candles: await fetchCandles(pair, tf) }))
  );
  return results.filter(
    (r): r is { tf: Tf; candles: Candle[] } => !!r.candles && r.candles.length > 1
  );
}

export type Spot = { price: number; source: string; at: string };

/** Current price. For gold this is true XAU/USD spot, not the futures last. */
export async function fetchSpot(pair: Pair): Promise<Spot | null> {
  return cached(`spot:${pair}`, 60_000, async () => {
    if (pair === "BTCUSD") {
      for (const host of BINANCE_HOSTS) {
        try {
          const d = (await getJson(
            `${host}/api/v3/ticker/price?symbol=BTCUSDT`
          )) as { price: string };
          const price = Number(d.price);
          if (Number.isFinite(price)) {
            return { price, source: "Binance", at: new Date().toISOString() };
          }
        } catch {
          // try the next host
        }
      }
      // fall back to the last Yahoo close
      const candles = await fetchYahoo(YAHOO_SYMBOL.BTCUSD, "15M");
      return {
        price: candles[candles.length - 1].c,
        source: "Yahoo BTC-USD",
        at: new Date().toISOString(),
      };
    }
    try {
      const d = (await getJson("https://api.gold-api.com/price/XAU")) as {
        price: number;
        updatedAt?: string;
      };
      const price = Number(d.price);
      if (Number.isFinite(price)) {
        return {
          price,
          source: "gold-api XAU/USD spot",
          at: d.updatedAt ?? new Date().toISOString(),
        };
      }
    } catch {
      // fall through to PAXG
    }
    for (const host of BINANCE_HOSTS) {
      try {
        const d = (await getJson(
          `${host}/api/v3/ticker/price?symbol=PAXGUSDT`
        )) as { price: string };
        const price = Number(d.price);
        if (Number.isFinite(price)) {
          return { price, source: "Binance PAXG", at: new Date().toISOString() };
        }
      } catch {
        // try the next host
      }
    }
    throw new Error("no gold price source reachable");
  });
}

/** "$4,347.10" / "$81,856.25" */
export function formatPrice(pair: Pair, price: number): string {
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Dubai wall-clock stamp for the overlay. */
export function dubaiStamp(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} Dubai`;
}
