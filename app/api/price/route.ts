import { NextResponse } from "next/server";
import {
  candleSourceLabel,
  fetchCandles,
  fetchSpot,
  formatPrice,
} from "@/lib/v5/market_data";
import { PAIRS, type Pair } from "@/lib/v5/types";

/**
 * Live price feed for the landing page ENGINE FEED cards.
 *
 * `watching` is the level the engine is waiting for, derived from real 4H
 * structure rather than invented: the discount quartile of the recent 4H
 * range (low + 25% of the range). BUY setups wait for a discount, so that is
 * the level shown; if candles are unavailable it falls back to spot.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PairPayload = {
  price: number | null;
  priceText: string;
  watching: number | null;
  watchingText: string;
  source: string;
  candleSource: string;
};

const round = (pair: Pair, v: number) =>
  pair === "XAUUSD" ? Math.round(v * 100) / 100 : Math.round(v * 100) / 100;

async function forPair(pair: Pair): Promise<PairPayload> {
  const [spot, candles] = await Promise.all([
    fetchSpot(pair),
    fetchCandles(pair, "4H").catch(() => null),
  ]);

  let watching: number | null = null;
  if (candles && candles.length > 4) {
    const recent = candles.slice(-40);
    const high = Math.max(...recent.map((c) => c.h));
    const low = Math.min(...recent.map((c) => c.l));
    if (high > low) watching = round(pair, low + (high - low) * 0.25);
  }
  if (watching === null && spot) {
    // no candles — approximate a discount a little under spot
    watching = round(pair, spot.price * 0.99);
  }

  return {
    price: spot ? round(pair, spot.price) : null,
    priceText: spot ? formatPrice(pair, spot.price) : "—",
    watching,
    watchingText: watching !== null ? formatPrice(pair, watching) : "—",
    source: spot?.source ?? "unavailable",
    candleSource: candleSourceLabel(pair),
  };
}

export async function GET() {
  try {
    const [xau, btc] = await Promise.all(
      (PAIRS as readonly Pair[]).map((p) => forPair(p))
    );

    return NextResponse.json(
      {
        ok: true,
        at: new Date().toISOString(),
        // flat keys, as the landing component consumes them
        xau: xau.price,
        btc: btc.price,
        xauWatching: xau.watching,
        btcWatching: btc.watching,
        pairs: { XAUUSD: xau, BTCUSD: btc },
      },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
