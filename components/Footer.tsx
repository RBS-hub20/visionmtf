import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { site, nav } from "@/lib/site";
import { Logo } from "./ui/Logo";

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-black">
      {/* top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-neon/40 to-transparent"
      />

      <div className="container py-14 sm:py-16">
        {/* ---- CTA band ---- */}
        <div className="glass noise edge-top flex flex-col items-start gap-6 overflow-hidden p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Stop guessing on one timeframe.
            </h2>
            <p className="pretty mt-2 max-w-lg text-sm leading-relaxed text-silver-dim sm:text-base">
              Join the private channel and see exactly what the engine sees — including the trades it
              decides not to take.
            </p>
          </div>
          <Link href="#pricing" className="btn-neon h-12 shrink-0 px-6">
            Join Private Access
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>

        {/* ---- link grid ---- */}
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo variant="full" className="max-w-[210px]" href={null} />
            <p className="pretty mt-5 max-w-sm text-sm leading-relaxed text-silver-dim">
              {site.tagline}. A multi-timeframe analysis engine for XAUUSD and BTCUSD that explains its
              reasoning in plain language — including when the answer is to wait.
            </p>
          </div>

          <div>
            <h3 className="eyebrow">Navigate</h3>
            <ul className="mt-4 space-y-2.5">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-silver-dim transition-colors hover:text-neon"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow">Coverage</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-silver-dim">
              <li>XAUUSD — Gold</li>
              <li>BTCUSD — Bitcoin</li>
              <li>MT5 Expert Advisor</li>
              <li>London &amp; New York sessions</li>
            </ul>
          </div>
        </div>

        {/* ---- risk disclaimer ---- */}
        <div className="mt-12 rounded-2xl border border-line bg-card/50 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warn" strokeWidth={2.2} />
            <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-warn">
              Risk Disclaimer
            </h3>
          </div>
          <p className="pretty mt-3 text-2xs leading-relaxed text-silver-dim sm:text-xs">
            VISION MTF is an <strong className="font-semibold text-silver">educational tool</strong> and
            technical-analysis software. It is{" "}
            <strong className="font-semibold text-silver">not financial advice</strong>, not investment
            advice, and not a recommendation to buy or sell any instrument. Trading foreign exchange,
            metals and cryptocurrencies on margin carries a high level of risk and may not be suitable
            for all investors. The high degree of leverage can work against you as well as for you.
            Before deciding to trade, you should carefully consider your investment objectives, level of
            experience and risk appetite. There is a possibility that you could sustain a loss of some or
            all of your initial investment and therefore you should not invest money that you cannot
            afford to lose. Past performance is not indicative of future results. Hypothetical or
            simulated performance results have inherent limitations. {site.name} and {site.legalName}{" "}
            accept no liability for any loss or damage arising from reliance on information provided.
            Always seek advice from an independent, licensed financial advisor if you have any doubts.
          </p>
        </div>

        {/* ---- bottom bar ---- */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line pt-7 sm:flex-row">
          <p className="text-2xs text-silver-dim">
            <span className="font-semibold text-silver">{site.name}</span> © {site.year} by{" "}
            <span className="font-semibold text-silver">{site.legalName}</span>. All rights reserved.
          </p>
          <p className="text-2xs text-silver-deep">
            {site.sub} · Built for traders who read the whole chart.
          </p>
        </div>
      </div>
    </footer>
  );
}
