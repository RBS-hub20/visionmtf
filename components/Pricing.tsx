"use client";

import Link from "next/link";
import { Check, X, Sparkles, Lock, CreditCard, ArrowUpRight } from "lucide-react";
import { plans, type Plan } from "@/lib/site";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { cn } from "@/lib/utils";

function PlanCard({ plan }: { plan: Plan }) {
  const popular = !!plan.popular;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 sm:p-7",
        popular
          ? "border-neon/40 bg-gradient-to-b from-neon/[0.07] via-card to-card shadow-[0_0_0_1px_rgba(0,255,136,0.18),0_50px_110px_-50px_rgba(0,255,136,0.55)] lg:-mt-4 lg:mb-[-1rem]"
          : "border-line bg-card hover:border-line-2"
      )}
    >
      {popular && (
        <>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
          <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-neon/40 bg-black px-3 py-1 shadow-[0_0_24px_rgba(0,255,136,0.35)]">
            <Sparkles className="h-3 w-3 text-neon" strokeWidth={2.5} />
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-neon">
              Most Popular
            </span>
          </span>
        </>
      )}

      {/* head */}
      <div className={cn(popular && "pt-2")}>
        <h3 className="text-lg font-semibold tracking-tight text-white">{plan.name}</h3>
        <p className="pretty mt-1.5 min-h-[40px] text-sm leading-relaxed text-silver-dim">
          {plan.blurb}
        </p>
      </div>

      {/* price */}
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="num text-[2.75rem] font-bold leading-none tracking-tight text-white">
          ${plan.price}
        </span>
        <span className="text-sm text-silver-dim">/month</span>
      </div>
      <p className="mt-2 text-2xs text-silver-deep">Billed monthly · cancel anytime</p>

      {/* cta */}
      <Link
        href={plan.href}
        target={plan.href.startsWith("http") ? "_blank" : undefined}
        rel={plan.href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={cn("mt-6 h-12 w-full", popular ? "btn-neon" : "btn-ghost")}
      >
        {plan.cta}
        <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
      </Link>

      <div className="my-6 divider" />

      {/* features */}
      <ul className="flex flex-1 flex-col gap-2.5">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5">
            {f.included ? (
              <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neon/35 bg-neon/10">
                <Check className="h-2.5 w-2.5 text-neon" strokeWidth={3.5} />
              </span>
            ) : (
              <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line-2">
                <X className="h-2.5 w-2.5 text-silver-deep" strokeWidth={3} />
              </span>
            )}
            <span
              className={cn(
                "text-[0.83rem] leading-snug",
                f.included ? "text-silver" : "text-silver-deep line-through decoration-silver-deep/50"
              )}
            >
              {f.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="section relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-10 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,255,136,0.10),transparent)]"
      />

      <div className="container relative">
        <SectionHeading
          eyebrow="Pricing"
          title={
            <>
              One subscription.{" "}
              <span className="text-silver-metal">The whole desk.</span>
            </>
          }
          subtitle="No upsells, no signal-group nonsense, no lifetime deals. Pick the market coverage you need and cancel the month you stop finding it useful."
        />

        <div className="mt-14 grid items-stretch gap-5 lg:mt-20 lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 0.08} className="h-full">
              <PlanCard plan={plan} />
            </Reveal>
          ))}
        </div>

        {/* trust row */}
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-2xl border border-line bg-card/50 px-6 py-5 sm:flex-row sm:gap-8">
            <span className="inline-flex items-center gap-2 text-2xs text-silver-dim">
              <Lock className="h-3.5 w-3.5 text-neon" strokeWidth={2.2} />
              Secure checkout by Stripe
            </span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="inline-flex items-center gap-2 text-2xs text-silver-dim">
              <CreditCard className="h-3.5 w-3.5 text-neon" strokeWidth={2.2} />
              All major cards · Apple Pay · Google Pay
            </span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="inline-flex items-center gap-2 text-2xs text-silver-dim">
              <Check className="h-3.5 w-3.5 text-neon" strokeWidth={2.8} />
              Instant Telegram access on payment
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
