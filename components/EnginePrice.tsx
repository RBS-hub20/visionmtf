"use client";

import { useEffect, useState } from "react";
import type { Pair } from "@/lib/v5/types";

/**
 * Live price text for the landing ENGINE FEED cards.
 *
 * Renders the seeded fallback on the server and on first client paint — so
 * hydration matches exactly — then swaps in the live figure once /api/price
 * responds, refreshing every 60s.
 *
 * Purely a text swap: no classes, colours or layout come from here.
 */

export type PricePayload = {
  ok: boolean;
  pairs: Record<
    Pair,
    { priceText: string; watchingText: string; source: string; candleSource: string }
  >;
};

type Field = "price" | "watching";

let inflight: Promise<PricePayload | null> | null = null;
let cached: { data: PricePayload; at: number } | null = null;

/** One fetch shared by all four mounted instances, refreshed every 60s. */
async function loadPrices(): Promise<PricePayload | null> {
  if (cached && Date.now() - cached.at < 55_000) return cached.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/price", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as PricePayload;
      if (!data?.ok || !data.pairs) return null;
      cached = { data, at: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function EnginePrice({
  pair,
  field,
  fallback,
}: {
  pair: Pair;
  field: Field;
  fallback: string;
}) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const data = await loadPrices();
      if (!alive || !data) return;
      const entry = data.pairs[pair];
      if (!entry) return;
      const next = field === "price" ? entry.priceText : entry.watchingText;
      if (next && next !== "—") setText(next);
    };

    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pair, field]);

  return <>{text}</>;
}

/** "LIVE • TwelveData Spot / Binance" micro-label under CURRENT. */
export function EnginePriceSource({ pair }: { pair: Pair }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const data = await loadPrices();
      if (!alive || !data) return;
      const entry = data.pairs[pair];
      if (entry?.source) setLabel(entry.source);
    };

    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pair]);

  if (!label) return null;

  return (
    <div className="mt-1 flex items-center gap-1 text-[0.5rem] font-medium uppercase tracking-[0.1em] text-silver-deep">
      <span className="h-1 w-1 rounded-full bg-neon shadow-[0_0_6px_1px_rgba(0,255,136,0.8)]" />
      <span className="truncate">LIVE · {label}</span>
    </div>
  );
}
