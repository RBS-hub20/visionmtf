"use client";

import { motion } from "framer-motion";
import {
  Check,
  Clock,
  Zap,
  ArrowRight,
  Hourglass,
  BookOpen,
  HeartPulse,
  Radar,
} from "lucide-react";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { TelegramPhone, Bubble } from "./TelegramPhone";
import { TelegramChart } from "./TelegramChart";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */

function SystemLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-full border border-line bg-black/70 px-2.5 py-1 text-[0.58rem] font-medium uppercase tracking-[0.14em] text-silver-deep">
        {children}
      </span>
    </div>
  );
}

function ConfluenceRow({
  tf,
  label,
  done,
}: {
  tf: string;
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span
        className={cn(
          "num flex h-[18px] w-8 shrink-0 items-center justify-center rounded border text-[0.55rem] font-bold",
          done ? "border-neon/35 bg-neon/10 text-neon" : "border-line-2 bg-white/[0.02] text-silver-dim"
        )}
      >
        {tf}
      </span>
      <span className={cn("flex-1 text-[0.68rem]", done ? "text-silver" : "text-silver-dim")}>
        {label}
      </span>
      {done ? (
        <Check className="h-3 w-3 shrink-0 text-neon" strokeWidth={3} />
      ) : (
        <Clock className="h-3 w-3 shrink-0 text-warn" strokeWidth={2.5} />
      )}
    </div>
  );
}

/* ---------------------------- RR ladder --------------------------- */

function RrLadder() {
  // SL 2628 · Entry 2635 · TP 2655  →  risk 7, reward 20
  return (
    <div className="mt-3">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-black ring-1 ring-inset ring-line">
        <div className="absolute inset-y-0 left-0 w-[25.9%] bg-gradient-to-r from-danger/70 to-danger/30" />
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "74.1%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 left-[25.9%] bg-gradient-to-r from-neon/40 to-neon"
        />
        <div className="absolute inset-y-0 left-[25.9%] w-[2px] bg-white shadow-[0_0_8px_1px_rgba(255,255,255,0.7)]" />
      </div>
      <div className="mt-1.5 flex justify-between text-[0.55rem] font-semibold">
        <span className="num text-danger">SL 2628</span>
        <span className="num text-white">ENTRY 2635</span>
        <span className="num text-neon">TP 2655</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const benefits = [
  {
    icon: Hourglass,
    title: "Fewer trades. Far better ones.",
    body: "A WAIT is a decision, not silence. The engine would rather sit through a whole session than take a setup that only two timeframes agree on.",
  },
  {
    icon: BookOpen,
    title: "You learn while it works.",
    body: "Every alert names the exact concept in play — premium, order block, fair value gap, break of structure. After a month you read charts the way it does.",
  },
  {
    icon: HeartPulse,
    title: "No FOMO. No revenge trades.",
    body: "When you can see what the AI is waiting for and the price level it needs, the urge to force an entry disappears. That is where accounts are saved.",
  },
];

export function WaitFeature() {
  return (
    <section className="section relative overflow-hidden">
      {/* section ambience */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[36rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,255,136,0.08),transparent)]"
      />

      <div className="container relative">
        <SectionHeading
          eyebrow="The WAIT Feature"
          title={
            <>
              Every other bot screams <span className="text-danger/90">BUY</span>. This one
              tells you to{" "}
              <span className="text-[#FFB020]">WAIT</span>
              <span className="text-silver-metal"> — and why.</span>
            </>
          }
          subtitle="This is the whole product. A signal that says BUY teaches you nothing. A signal that says “I am waiting for price to reach the 4H discount order block at $2,635, then I need a 15M break of structure” makes you a better trader whether you take it or not."
        />

        {/* ---------------- phones ---------------- */}
        <div className="relative mt-16 grid gap-14 lg:mt-24 lg:grid-cols-2 lg:gap-8 xl:gap-16">
          {/* flow arrow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-black shadow-[0_0_50px_rgba(0,0,0,1)]"
            >
              <ArrowRight className="h-5 w-5 text-neon" strokeWidth={2.5} />
            </motion.div>
          </div>

          {/* ======================= WAIT ======================= */}
          <Reveal>
            <div className="flex flex-col items-center">
              <div className="mb-7 flex flex-col items-center gap-2 text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-warn/30 bg-warn/[0.08] px-3 py-1.5">
                  <Clock className="h-3.5 w-3.5 text-warn" strokeWidth={2.5} />
                  <span className="text-2xs font-bold uppercase tracking-[0.2em] text-warn">
                    State 01 — Holding
                  </span>
                </span>
                <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  When the setup is not ready
                </h3>
                <p className="max-w-xs text-sm text-silver-dim">
                  68% confidence. Direction is right, location is wrong.
                </p>
              </div>

              <TelegramPhone accent="warn" status="scanning 5 timeframes…">
                <SystemLine>London session · 08:12</SystemLine>

                <Bubble time="08:14" views="11.2K" accent="warn">
                  {/* header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md bg-warn px-2 py-[3px] text-[0.62rem] font-extrabold tracking-wide text-black">
                        <Clock className="h-3 w-3" strokeWidth={3} />
                        WAIT
                      </span>
                      <span className="num text-sm font-bold text-white">XAUUSD</span>
                    </div>
                    <span className="num rounded-md border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[0.65rem] font-bold text-warn">
                      68%
                    </span>
                  </div>

                  {/* chart */}
                  <div className="mt-2.5 overflow-hidden rounded-lg border border-line">
                    <TelegramChart />
                  </div>

                  {/* reasoning */}
                  <p className="mt-2.5 text-[0.72rem] leading-relaxed text-silver">
                    Price is in{" "}
                    <span className="font-semibold text-danger">Premium at $2,655.40</span>. I am not
                    buying here. Waiting for the{" "}
                    <span className="font-semibold text-neon">Discount 4H OB at $2,635</span>.
                  </p>
                  <p className="mt-1.5 text-[0.72rem] leading-relaxed text-silver">
                    Execution only on a{" "}
                    <span className="font-semibold text-white">15M break of structure</span> inside the
                    zone.
                  </p>

                  {/* checklist */}
                  <div className="mt-2.5 rounded-lg border border-line bg-black/50 px-2.5 py-2">
                    <ConfluenceRow tf="W" label="Bullish — trend intact" done />
                    <ConfluenceRow tf="D" label="Bullish — higher lows" done />
                    <ConfluenceRow tf="4H" label="OB mapped at 2635" done />
                    <ConfluenceRow tf="1H" label="FVG still open above" done={false} />
                    <ConfluenceRow tf="15M" label="Awaiting BOS" done={false} />
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-warn/20 bg-warn/[0.06] px-2.5 py-1.5">
                    <Radar className="h-3 w-3 shrink-0 text-warn" strokeWidth={2.5} />
                    <span className="text-[0.62rem] font-semibold text-warn">
                      No action required. You will be alerted at the zone.
                    </span>
                  </div>
                </Bubble>
              </TelegramPhone>
            </div>
          </Reveal>

          {/* ======================= EXECUTE ======================= */}
          <Reveal delay={0.12}>
            <div className="flex flex-col items-center">
              <div className="mb-7 flex flex-col items-center gap-2 text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/[0.08] px-3 py-1.5">
                  <Zap className="h-3.5 w-3.5 text-neon" strokeWidth={2.5} />
                  <span className="text-2xs font-bold uppercase tracking-[0.2em] text-neon">
                    State 02 — Armed
                  </span>
                </span>
                <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  When all five line up
                </h3>
                <p className="max-w-xs text-sm text-silver-dim">
                  92% confidence. Direction and location agree.
                </p>
              </div>

              <TelegramPhone accent="neon" status="signal published · execution armed">
                <SystemLine>London session · 11:47</SystemLine>

                <Bubble time="11:48" views="11.9K" accent="neon">
                  {/* header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md bg-neon px-2 py-[3px] text-[0.62rem] font-extrabold tracking-wide text-black">
                        <Zap className="h-3 w-3" strokeWidth={3} />
                        BUY
                      </span>
                      <span className="num text-sm font-bold text-white">XAUUSD</span>
                    </div>
                    <span className="num rounded-md border border-neon/35 bg-neon/10 px-1.5 py-0.5 text-[0.65rem] font-bold text-neon">
                      92%
                    </span>
                  </div>

                  {/* levels */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {[
                      { k: "ENTRY", v: "$2,635.00", tone: "text-white" },
                      { k: "STOP LOSS", v: "$2,628.00", tone: "text-danger" },
                      { k: "TAKE PROFIT", v: "$2,655.00", tone: "text-neon" },
                      { k: "RISK : REWARD", v: "1 : 2.8", tone: "text-neon" },
                    ].map((c) => (
                      <div key={c.k} className="rounded-lg border border-line bg-black/60 px-2.5 py-2">
                        <div className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-silver-deep">
                          {c.k}
                        </div>
                        <div className={cn("num mt-0.5 text-[0.82rem] font-bold", c.tone)}>{c.v}</div>
                      </div>
                    ))}
                  </div>

                  <RrLadder />

                  {/* confluence */}
                  <div className="mt-3 rounded-lg border border-neon/20 bg-neon/[0.04] px-2.5 py-2">
                    <div className="mb-1 text-[0.52rem] font-bold uppercase tracking-[0.18em] text-neon/70">
                      Confluence · 5 / 5
                    </div>
                    <ConfluenceRow tf="W" label="Bullish — macro trend up" done />
                    <ConfluenceRow tf="D" label="Bullish — structure intact" done />
                    <ConfluenceRow tf="4H" label="OB tapped at discount" done />
                    <ConfluenceRow tf="1H" label="FVG filled — imbalance closed" done />
                    <ConfluenceRow tf="15M" label="BOS confirmed + liquidity swept" done />
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-neon/25 bg-neon/[0.08] px-2.5 py-1.5">
                    <Check className="h-3 w-3 shrink-0 text-neon" strokeWidth={3} />
                    <span className="text-[0.62rem] font-semibold text-neon">
                      Risk 1% max · move SL to break-even at 1R.
                    </span>
                  </div>
                </Bubble>
              </TelegramPhone>
            </div>
          </Reveal>
        </div>

        {/* ---------------- benefits ---------------- */}
        <div className="mt-20 grid gap-5 sm:mt-24 md:grid-cols-3 md:gap-6">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.08}>
              <div className="card noise h-full p-6 transition-colors duration-300 hover:border-neon/25">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-2 bg-black">
                  <b.icon className="h-[18px] w-[18px] text-neon" strokeWidth={2} />
                </span>
                <h4 className="mt-4 text-base font-semibold tracking-tight text-white">{b.title}</h4>
                <p className="pretty mt-2 text-sm leading-relaxed text-silver-dim">{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
