"use client";

import { motion } from "framer-motion";
import { X, Check, TrendingDown, Target, Layers, Ban, Timer, Crosshair } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Chart A — single timeframe bot buys the high                       */
/* ------------------------------------------------------------------ */

function SingleTfChart() {
  return (
    <svg viewBox="0 0 360 180" className="w-full" role="img" aria-label="A single-timeframe bot buys the high and is stopped out">
      <defs>
        <linearGradient id="fail-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF4D4D" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#FF4D4D" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid */}
      <g stroke="#1A1A1A" strokeWidth="1">
        {[36, 72, 108, 144].map((y) => (
          <line key={y} x1="10" y1={y} x2="350" y2={y} />
        ))}
      </g>

      {/* area + line */}
      <path
        d="M14 140 L44 128 L74 132 L104 110 L134 96 L164 72 L194 48 L206 40 L224 62 L254 86 L284 112 L314 132 L344 146 L344 176 L14 176 Z"
        fill="url(#fail-fill)"
      />
      <motion.polyline
        points="14,140 44,128 74,132 104,110 134,96 164,72 194,48 206,40 224,62 254,86 284,112 314,132 344,146"
        fill="none"
        stroke="#FF6B6B"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
      />

      {/* stop loss */}
      <line x1="10" y1="64" x2="350" y2="64" stroke="#FF4D4D" strokeWidth="1" strokeDasharray="4 5" opacity="0.7" />
      <text x="14" y="59" fontSize="8" fontWeight="700" fill="#FF4D4D" letterSpacing="1">
        SL
      </text>

      {/* entry marker at the high */}
      <g>
        <circle cx="206" cy="40" r="5.5" fill="#FF4D4D" />
        <circle cx="206" cy="40" r="10" fill="none" stroke="#FF4D4D" strokeWidth="1" opacity="0.45" />
        <rect x="158" y="12" width="96" height="19" rx="6" fill="#1A0B0B" stroke="#3A1515" />
        <text x="206" y="25" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#FF6B6B" letterSpacing="0.8">
          BUY — 15M ONLY
        </text>
      </g>

      {/* stopped out */}
      <g>
        <rect x="224" y="70" width="80" height="19" rx="6" fill="#1A0B0B" stroke="#3A1515" />
        <text x="264" y="83" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#FF6B6B" letterSpacing="0.6">
          STOPPED OUT
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart B — MTF waits for discount, then executes                    */
/* ------------------------------------------------------------------ */

function MtfChart() {
  return (
    <svg viewBox="0 0 360 180" className="w-full" role="img" aria-label="VISION MTF waits in premium, enters at the discount order block and runs to target">
      <defs>
        <linearGradient id="win-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00FF88" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* premium / discount zones */}
      <rect x="10" y="18" width="340" height="44" fill="#FF4D4D" opacity="0.055" />
      <line x1="10" y1="62" x2="350" y2="62" stroke="#FF4D4D" strokeWidth="1" strokeDasharray="3 6" opacity="0.4" />
      <text x="346" y="30" textAnchor="end" fontSize="7.5" fontWeight="700" fill="#FF6B6B" letterSpacing="1.6">
        PREMIUM
      </text>

      <rect x="10" y="112" width="340" height="40" fill="#00FF88" opacity="0.07" />
      <line x1="10" y1="112" x2="350" y2="112" stroke="#00FF88" strokeWidth="1" strokeDasharray="3 6" opacity="0.45" />
      <text x="346" y="147" textAnchor="end" fontSize="7.5" fontWeight="700" fill="#00FF88" letterSpacing="1.6">
        DISCOUNT
      </text>

      {/* 4H order block */}
      <rect x="228" y="124" width="72" height="24" rx="3" fill="#00FF88" opacity="0.14" stroke="#00FF88" strokeOpacity="0.5" />
      <text x="234" y="139" fontSize="7.5" fontWeight="700" fill="#00FF88" letterSpacing="0.8">
        4H OB
      </text>

      {/* price */}
      <path
        d="M14 76 L44 58 L74 44 L104 34 L134 42 L164 36 L194 70 L224 100 L252 130 L262 136 L282 118 L304 94 L326 62 L346 34 L346 176 L14 176 Z"
        fill="url(#win-fill)"
        opacity="0.55"
      />
      <motion.polyline
        points="14,76 44,58 74,44 104,34 134,42 164,36 194,70 224,100 252,130 262,136 282,118 304,94 326,62 346,34"
        fill="none"
        stroke="#00FF88"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />

      {/* WAIT badge in premium */}
      <g>
        <rect x="72" y="8" width="64" height="18" rx="6" fill="#161000" stroke="#4A3708" />
        <circle cx="84" cy="17" r="2.6" fill="#FFB020" />
        <text x="94" y="21" fontSize="8.5" fontWeight="700" fill="#FFB020" letterSpacing="1">
          WAIT
        </text>
      </g>
      <line x1="104" y1="30" x2="104" y2="26" stroke="#FFB020" strokeWidth="1" />

      {/* entry */}
      <circle cx="262" cy="136" r="5" fill="#00FF88" />
      <circle cx="262" cy="136" r="9.5" fill="none" stroke="#00FF88" strokeWidth="1" opacity="0.5" />

      {/* TP */}
      <g>
        <circle cx="346" cy="34" r="4" fill="#00FF88" />
        <rect x="266" y="6" width="84" height="19" rx="6" fill="#00190F" stroke="#0C4A2E" />
        <text x="308" y="19" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#00FF88" letterSpacing="0.6">
          TP · 1:2.8 RR
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Confluence meter                                                   */
/* ------------------------------------------------------------------ */

function ConfluenceMeter({ lit, tone }: { lit: number; tone: "fail" | "win" }) {
  const tfs = ["W", "D", "4H", "1H", "15M"];
  return (
    <div className="flex items-center gap-1.5">
      {tfs.map((tf, i) => {
        const on = tone === "win" ? true : i >= tfs.length - lit;
        return (
          <div
            key={tf}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-md border text-[0.6rem] font-bold transition-colors",
              on && tone === "win" && "border-neon/45 bg-neon/10 text-neon",
              on && tone === "fail" && "border-danger/40 bg-danger/10 text-danger",
              !on && "border-line bg-white/[0.02] text-silver-deep"
            )}
          >
            {tf}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const failPoints = [
  { icon: Timer, text: "Sees one candle series. No idea the Weekly is in a pullback." },
  { icon: TrendingDown, text: "Buys premium prices because the 15M looks strong." },
  { icon: Ban, text: "Fires 20+ signals a day. Most are noise inside a range." },
];

const winPoints = [
  { icon: Layers, text: "Weekly & Daily set direction before anything else is considered." },
  { icon: Crosshair, text: "4H & 1H locate the discount zone — order block and fair value gap." },
  { icon: Target, text: "15M only pulls the trigger after a confirmed break of structure." },
];

export function WhyMTF() {
  return (
    <section id="product" className="section">
      <div className="container">
        <SectionHeading
          eyebrow="Why MTF Matters"
          title={
            <>
              One timeframe is a guess.{" "}
              <span className="text-silver-metal">Five is a thesis.</span>
            </>
          }
          subtitle="Most trading bots read a single chart and call it analysis. That is how you end up long at the top of a range while the higher timeframe is still selling."
        />

        <div className="relative mt-14 grid gap-6 lg:mt-20 lg:grid-cols-2 lg:gap-8">
          {/* VS divider */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-black text-2xs font-bold tracking-widest text-silver-dim shadow-[0_0_40px_rgba(0,0,0,1)]">
              VS
            </div>
          </div>

          {/* ---------- FAIL ---------- */}
          <Reveal>
            <div className="card noise relative h-full overflow-hidden p-6 sm:p-8">
              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(closest-side,rgba(255,77,77,0.10),transparent)]" />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger/30 bg-danger/10">
                    <X className="h-4 w-4 text-danger" strokeWidth={3} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white">The Typical Bot</h3>
                    <p className="text-2xs text-silver-dim">Single timeframe · 15M only</p>
                  </div>
                </div>
                <span className="chip border-danger/30 bg-danger/10 text-danger">1 / 5 TF</span>
              </div>

              <div className="mt-6 rounded-xl border border-line bg-black/40 p-3">
                <SingleTfChart />
              </div>

              <div className="mt-5">
                <ConfluenceMeter lit={1} tone="fail" />
              </div>

              <ul className="mt-6 space-y-3">
                {failPoints.map((p) => (
                  <li key={p.text} className="flex gap-3">
                    <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-danger/80" strokeWidth={2} />
                    <span className="pretty text-sm leading-relaxed text-silver-dim">{p.text}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between rounded-xl border border-danger/20 bg-danger/[0.06] px-4 py-3">
                <span className="text-2xs font-semibold uppercase tracking-widest text-danger/80">
                  Outcome
                </span>
                <span className="num text-sm font-bold text-danger">Bought the high · −1R</span>
              </div>
            </div>
          </Reveal>

          {/* ---------- WIN ---------- */}
          <Reveal delay={0.1}>
            <div className="glass noise edge-top relative h-full overflow-hidden p-6 shadow-[0_0_0_1px_rgba(0,255,136,0.14),0_40px_100px_-50px_rgba(0,255,136,0.35)] sm:p-8">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgba(0,255,136,0.16),transparent)]" />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neon/35 bg-neon/10">
                    <Check className="h-4 w-4 text-neon" strokeWidth={3} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white">VISION MTF</h3>
                    <p className="text-2xs text-silver-dim">Weekly → 15M · full confluence</p>
                  </div>
                </div>
                <span className="chip-neon">5 / 5 TF</span>
              </div>

              <div className="mt-6 rounded-xl border border-line bg-black/40 p-3">
                <MtfChart />
              </div>

              <div className="mt-5">
                <ConfluenceMeter lit={5} tone="win" />
              </div>

              <ul className="mt-6 space-y-3">
                {winPoints.map((p) => (
                  <li key={p.text} className="flex gap-3">
                    <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-neon" strokeWidth={2} />
                    <span className="pretty text-sm leading-relaxed text-silver">{p.text}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between rounded-xl border border-neon/25 bg-neon/[0.07] px-4 py-3">
                <span className="text-2xs font-semibold uppercase tracking-widest text-neon/80">
                  Outcome
                </span>
                <span className="num text-sm font-bold text-neon">Entered discount · 1:2.8 RR</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
