"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Clock, Target, ArrowUpRight, Waves } from "lucide-react";
import Link from "next/link";
import { liveStatus, beta, site, type AssetStatus } from "@/lib/site";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { cn } from "@/lib/utils";

/* ---------------------------- gauge ---------------------------- */

const R = 42;
const C = 2 * Math.PI * R;

function Gauge({ value }: { value: number }) {
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={R} fill="none" stroke="#161616" strokeWidth="7" />
        <motion.circle
          cx="52"
          cy="52"
          r={R}
          fill="none"
          stroke="#FFB020"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          whileInView={{ strokeDashoffset: C * (1 - value / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: "drop-shadow(0 0 8px rgba(255,176,32,0.55))" }}
        />
        {/* threshold tick at 85% — the arc starts at 3 o'clock locally and the
            whole svg is turned -90deg, so the tick needs 306 + 90 degrees */}
        <line
          x1="52"
          y1="6"
          x2="52"
          y2="16"
          stroke="#00FF88"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform="rotate(36 52 52)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-2xl font-bold leading-none text-white">{value}%</span>
        <span className="mt-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-silver-deep">
          conf
        </span>
      </div>
    </div>
  );
}

/* ---------------------------- card ---------------------------- */

const BIAS_STYLE: Record<string, string> = {
  bullish: "border-neon/35 bg-neon/10 text-neon",
  bearish: "border-danger/35 bg-danger/10 text-danger",
  neutral: "border-line-2 bg-white/[0.02] text-silver-dim",
};

const BIAS_GLYPH: Record<string, string> = {
  bullish: "▲",
  bearish: "▼",
  neutral: "•",
};

function AssetCard({ asset }: { asset: AssetStatus }) {
  return (
    <div className="glass noise relative h-full overflow-hidden p-5 sm:p-6">
      {/* scan line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-scan-y bg-gradient-to-r from-transparent via-neon/60 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="num text-lg font-bold tracking-tight text-white">{asset.symbol}</h3>
            <span className="rounded border border-line bg-black px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-silver-dim">
              live
            </span>
          </div>
          <p className="mt-0.5 truncate text-2xs text-silver-dim">{asset.name}</p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-warn/30 bg-warn/[0.08] px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-warn opacity-70 animate-pulse-ring" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warn" />
            </span>
            <span className="text-2xs font-bold uppercase tracking-[0.16em] text-warn">
              {asset.state}
            </span>
          </div>
        </div>

        <Gauge value={asset.confidence} />
      </div>

      {/* levels */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-line bg-black/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-silver-deep">
            <Activity className="h-3 w-3" strokeWidth={2.5} /> Current
          </div>
          <div className="num mt-1 text-base font-bold text-white">{asset.price}</div>
        </div>
        <div className="rounded-xl border border-line bg-black/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-silver-deep">
            <Target className="h-3 w-3" strokeWidth={2.5} /> Watching
          </div>
          <div className="num mt-1 text-base font-bold text-neon">{asset.target}</div>
        </div>
      </div>

      {/* timeframe biases */}
      <div className="mt-4">
        <div className="mb-2 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-silver-deep">
          Timeframe read
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {asset.biases.map((b) => (
            <div
              key={b.tf}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border py-1.5",
                BIAS_STYLE[b.state]
              )}
            >
              <span className="num text-[0.6rem] font-bold">{b.tf}</span>
              <span className="text-[0.55rem] leading-none">{BIAS_GLYPH[b.state]}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="pretty mt-4 border-t border-line pt-4 text-[0.8rem] leading-relaxed text-silver-dim">
        {asset.note}
      </p>
    </div>
  );
}

/* ---------------------------- section ---------------------------- */

export function LiveStatus() {
  const [secs, setSecs] = useState(3);

  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s >= 12 ? 1 : s + 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="live-status" className="section border-y border-line/60 bg-[#050505]">
      <div className="container">
        <SectionHeading
          eyebrow="Live AI Status"
          title={
            <>
              What the engine is doing{" "}
              <span className="text-neon-metal">right now.</span>
            </>
          }
          subtitle="This is the same state the private channel sees. Most of the time the honest answer is “not yet” — and that is exactly the point."
        />

        <Reveal>
          <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-card/60 lg:mt-16">
            {/* console bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-black/60 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-neon opacity-70 animate-pulse-ring" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-neon shadow-[0_0_10px_2px_rgba(0,255,136,0.8)]" />
                </span>
                <span className="text-2xs font-bold uppercase tracking-[0.2em] text-white">
                  Engine feed
                </span>
                <span className="hidden text-2xs text-silver-deep sm:inline">/ v4.2</span>
              </div>

              <div className="flex items-center gap-4 text-2xs text-silver-dim">
                <span className="inline-flex items-center gap-1.5">
                  <Waves className="h-3 w-3 text-neon" strokeWidth={2.5} />
                  London · New York
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" strokeWidth={2.5} />
                  synced <span className="num text-silver">{secs}s</span> ago
                </span>
              </div>
            </div>

            {/* cards */}
            <div className="grid gap-4 p-4 sm:gap-5 sm:p-5 lg:grid-cols-2">
              {liveStatus.map((a) => (
                <AssetCard key={a.symbol} asset={a} />
              ))}
            </div>

            {/* footer */}
            <div className="flex flex-col items-start justify-between gap-3 border-t border-line bg-black/60 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <p className="text-2xs text-silver-dim">
                State flips to{" "}
                <span className="font-bold text-neon">EXECUTE</span> the moment confidence clears 85%
                — delivered to Telegram in the same second.
              </p>
              <Link
                href={beta.active ? site.telegram : "#pricing"}
                target={beta.active ? "_blank" : undefined}
                rel={beta.active ? "noopener noreferrer" : undefined}
                className="btn-neon min-h-[2.25rem] shrink-0 whitespace-normal px-4 py-2 text-center text-xs leading-snug"
              >
                {beta.active ? beta.cta : "Get the live feed"}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </Reveal>

        <p className="mt-5 text-center text-2xs text-silver-deep">
          Status shown is an illustrative snapshot of the engine output. Past performance does not
          guarantee future results.
        </p>
      </div>
    </section>
  );
}
