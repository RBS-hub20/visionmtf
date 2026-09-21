"use client";

import { motion } from "framer-motion";
import { Compass, Crosshair, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal, RevealGroup, RevealItem } from "./ui/Reveal";

const steps = [
  {
    n: "01",
    icon: Compass,
    tfs: ["W", "D"],
    title: "Establish the trend",
    lead: "Weekly & Daily",
    body: "The engine starts where money is actually made: the higher timeframe. If Weekly and Daily disagree, nothing below them matters and the system stands down.",
    chips: ["Market structure", "Swing highs / lows", "Directional bias", "Trend maturity"],
  },
  {
    n: "02",
    icon: Crosshair,
    tfs: ["4H", "1H"],
    title: "Locate the setup",
    lead: "4 Hour & 1 Hour",
    body: "With direction fixed, VISION MTF maps where price is expensive and where it is cheap — then marks the exact zone it is prepared to trade from.",
    chips: ["Premium / Discount", "Order blocks (OB)", "Fair value gaps (FVG)", "Imbalance"],
  },
  {
    n: "03",
    icon: Zap,
    tfs: ["15M"],
    title: "Execute the trigger",
    lead: "15 Minute",
    body: "No entry is taken on hope. The 15M must confirm a break of structure and a clean liquidity sweep before a single order is published.",
    chips: ["Break of structure", "Liquidity sweep", "Entry / SL / TP", "Risk : Reward"],
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section border-y border-line/60 bg-[#050505]">
      <div className="container">
        <SectionHeading
          eyebrow="How It Works"
          title={
            <>
              Top down. Every time.{" "}
              <span className="text-neon-metal">No exceptions.</span>
            </>
          }
          subtitle="Three gates, in order. A signal only exists when all three agree — and even then it has to clear the confidence filter."
        />

        <RevealGroup className="relative mt-14 grid gap-5 lg:mt-20 lg:grid-cols-3 lg:gap-6">
          {/* connector rail */}
          <div className="pointer-events-none absolute inset-x-0 top-[68px] hidden lg:block">
            <div className="mx-[16.6%] h-px bg-gradient-to-r from-transparent via-line-2 to-transparent" />
          </div>

          {steps.map((s, i) => (
            <RevealItem key={s.n}>
              <div className="group card noise relative h-full overflow-hidden p-6 transition-colors duration-300 hover:border-neon/30 sm:p-7">
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(closest-side,rgba(0,255,136,0.10),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                {/* head */}
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-2 bg-black">
                    <s.icon className="h-5 w-5 text-neon" strokeWidth={2} />
                  </span>
                  <span className="num text-4xl font-bold leading-none text-white/[0.07] transition-colors duration-300 group-hover:text-neon/15">
                    {s.n}
                  </span>
                </div>

                {/* timeframe pills */}
                <div className="mt-6 flex items-center gap-1.5">
                  {s.tfs.map((tf) => (
                    <span
                      key={tf}
                      className="num rounded-md border border-neon/30 bg-neon/[0.08] px-2 py-1 text-[0.65rem] font-bold text-neon"
                    >
                      {tf}
                    </span>
                  ))}
                  <span className="ml-1 text-2xs uppercase tracking-[0.18em] text-silver-dim">
                    {s.lead}
                  </span>
                </div>

                <h3 className="mt-3.5 text-xl font-semibold tracking-tight text-white">{s.title}</h3>
                <p className="pretty mt-2.5 text-sm leading-relaxed text-silver-dim">{s.body}</p>

                <div className="my-5 divider" />

                <div className="flex flex-wrap gap-1.5">
                  {s.chips.map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                </div>

                {/* mobile arrow between steps */}
                {i < steps.length - 1 && (
                  <div className="absolute -bottom-[26px] left-1/2 z-10 hidden -translate-x-1/2 lg:block">
                    <ArrowRight className="h-4 w-4 text-line-2" />
                  </div>
                )}
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* -------- confidence gate -------- */}
        <Reveal delay={0.1}>
          <div className="glass noise edge-top mt-6 overflow-hidden p-6 sm:p-8 lg:mt-8">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:gap-10">
              <div className="lg:w-[38%]">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-neon" strokeWidth={2} />
                  <span className="eyebrow text-neon">The final gate</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  Below 85% confidence, nothing gets sent.
                </h3>
                <p className="pretty mt-2.5 text-sm leading-relaxed text-silver-dim">
                  Every candidate is scored across all five timeframes. Anything that scores under the
                  threshold is held as a <span className="font-medium text-warn">WAIT</span> — you still
                  see it, you just do not trade it yet.
                </p>
              </div>

              {/* meter */}
              <div className="lg:flex-1">
                <div className="flex items-end justify-between text-2xs text-silver-dim">
                  <span>0%</span>
                  <span className="font-semibold text-warn">68% · WAIT</span>
                  <span className="font-semibold text-neon">85% · THRESHOLD</span>
                  <span>100%</span>
                </div>

                <div className="relative mt-3 h-4 overflow-hidden rounded-full border border-line bg-black">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "68%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-warn/30 via-warn/60 to-warn/80"
                  />
                  {/* threshold marker */}
                  <div className="absolute inset-y-0 left-[85%] w-[2px] bg-neon shadow-[0_0_12px_2px_rgba(0,255,136,0.9)]" />
                  <div className="absolute inset-y-0 left-[85%] right-0 bg-[repeating-linear-gradient(45deg,rgba(0,255,136,0.12)_0px,rgba(0,255,136,0.12)_4px,transparent_4px,transparent_9px)]" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { k: "< 85%", v: "Held as WAIT", tone: "warn" },
                    { k: "≥ 85%", v: "Signal published", tone: "neon" },
                    { k: "Conflict", v: "Stand down", tone: "muted" },
                  ].map((row) => (
                    <div key={row.k} className="rounded-xl border border-line bg-black/50 px-3.5 py-3">
                      <div
                        className={
                          row.tone === "neon"
                            ? "num text-sm font-bold text-neon"
                            : row.tone === "warn"
                              ? "num text-sm font-bold text-warn"
                              : "num text-sm font-bold text-silver"
                        }
                      >
                        {row.k}
                      </div>
                      <div className="mt-0.5 text-2xs text-silver-dim">{row.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
