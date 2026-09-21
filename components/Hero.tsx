"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, LineChart, ShieldCheck, Cpu } from "lucide-react";
import { stats, marquee, beta, site } from "@/lib/site";
import { HeroVisual } from "./HeroVisual";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-40">
      <div className="container">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-16">
          {/* -------------------- copy -------------------- */}
          <div className="flex flex-col items-start">
            {/* live badge */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="group relative inline-flex max-w-full items-center gap-2.5 overflow-hidden rounded-full border border-neon/25 bg-neon/[0.06] py-1.5 pl-2.5 pr-3.5 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-neon opacity-70 animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neon shadow-[0_0_10px_2px_rgba(0,255,136,0.8)]" />
              </span>
              <span className="truncate text-2xs font-semibold tracking-wide text-neon sm:text-xs">
                LIVE: AI is <span className="font-bold">WAITING</span> on XAUUSD
                <span className="num mx-1 text-white">68%</span>
                <span className="hidden text-silver-dim sm:inline">· Watching $2,635 OB</span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
            </motion.div>

            {/* headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease }}
              className="balance mt-6 text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.1rem]"
            >
              The First AI That{" "}
              <span className="text-silver-metal">Sees The Market</span>{" "}
              <span className="relative inline-block">
                <span className="text-neon-metal">Like You Do.</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, delay: 0.9, ease }}
                  className="absolute -bottom-1.5 left-0 h-[3px] w-full origin-left rounded-full bg-gradient-to-r from-neon via-neon/70 to-transparent shadow-[0_0_18px_rgba(0,255,136,0.8)]"
                />
              </span>
            </motion.h1>

            {/* sub */}
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16, ease }}
              className="pretty mt-7 max-w-xl text-base leading-relaxed text-silver-dim sm:text-lg"
            >
              VISION MTF reads{" "}
              <span className="font-medium text-white">Weekly down to 15M</span>{" "}
              <span className="text-silver">(MTF = Multi Timeframe)</span>. It explains{" "}
              <span className="font-medium text-neon">why it&apos;s WAITING</span> — not just
              BUY/SELL. Built for XAUUSD &amp; BTC.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease }}
              className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
            >
              <Link
                href={beta.active ? site.telegram : "#pricing"}
                target={beta.active ? "_blank" : undefined}
                rel={beta.active ? "noopener noreferrer" : undefined}
                className="btn-neon min-h-[3rem] whitespace-normal px-6 py-2.5 text-center text-[0.95rem] leading-snug"
              >
                {beta.active ? beta.cta : "Get Private Access — $79/mo"}
                <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              </Link>
              <Link href="/live" className="btn-ghost min-h-[3rem] px-6 py-2.5 text-[0.95rem]">
                <LineChart className="h-4 w-4 text-neon" strokeWidth={2.2} />
                View Live Track Record
              </Link>
            </motion.div>

            {/* micro trust */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.34 }}
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-2xs text-silver-dim"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-neon" />
                {beta.active ? "No card needed" : "Cancel anytime"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-neon" /> 85%+ confidence filter
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LineChart className="h-3.5 w-3.5 text-neon" /> Full reasoning on every call
              </span>
            </motion.div>
          </div>

          {/* -------------------- visual -------------------- */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease }}
            className="relative mx-auto w-full max-w-[560px] lg:max-w-none"
          >
            <HeroVisual />
          </motion.div>
        </div>

        {/* -------------------- stat strip -------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease }}
          className="glass noise mt-16 grid grid-cols-2 divide-line sm:mt-20 lg:grid-cols-4 lg:divide-x"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 border-b border-line px-4 py-6 text-center last:border-b-0 sm:py-7 lg:border-b-0"
            >
              <span className="num text-2xl font-bold text-white sm:text-3xl">{s.value}</span>
              <span className="text-2xs uppercase tracking-[0.14em] text-silver-dim">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* -------------------- marquee -------------------- */}
      <div className="mask-fade-x relative mt-14 overflow-hidden border-y border-line/70 bg-black/40 py-3.5">
        <div className="flex w-max animate-marquee items-center gap-8">
          {[...marquee, ...marquee].map((item, i) => (
            <span key={i} className="flex shrink-0 items-center gap-8">
              <span className="text-2xs font-semibold uppercase tracking-[0.24em] text-silver-dim">
                {item}
              </span>
              <span className="h-1 w-1 rotate-45 bg-neon/60" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
