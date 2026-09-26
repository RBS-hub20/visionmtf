import type { Metadata } from "next";
import Link from "next/link";
import { promises as fs } from "fs";
import { ArrowLeft, RefreshCw, Radio, Brain, Clock } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { GridBackground } from "@/components/ui/GridBackground";
import {
  ACTION_TONE,
  BetaCta,
  ConfidenceBar,
  LiveDot,
  ScoreCards,
} from "@/components/live/parts";
import { History } from "@/components/live/History";
import { readHistory, storageBackend } from "@/lib/v5/store";
import { getStats } from "@/lib/v5/outcome_tracker";
import { chartFile } from "@/lib/v5/charts";
import { mockAnalysis } from "@/lib/v5/analyst";
import { site } from "@/lib/site";
import {
  PAIRS,
  SEND_THRESHOLD,
  type Action,
  type Pair,
  type TradeRecord,
} from "@/lib/v5/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live AI Status",
  description:
    "What the VISION MTF engine is reading right now across Weekly, Daily, 4H, 1H and 15M on XAUUSD and BTCUSD.",
};

/* ------------------------------------------------------------------ */

async function hasCharts(pair: Pair) {
  try {
    await fs.access(chartFile(pair, "W"));
    return true;
  } catch {
    return false;
  }
}

/** Newest row for a pair — WATCH rows count, they carry the current read. */
function latestFor(rows: TradeRecord[], pair: Pair): TradeRecord | null {
  return rows.find((r) => r.pair === pair) ?? null;
}

/** Spec wording for the live banner: WAITING / BULLISH / BEARISH. */
const HEADLINE_WORD: Record<Action, string> = {
  WAIT: "WAITING",
  BUY: "BULLISH",
  SELL: "BEARISH",
};

function ago(ts: string | null) {
  if (!ts) return "never";
  const diff = Date.now() - Date.parse(ts);
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ------------------------------------------------------------------ */

async function PairPanel({
  pair,
  record,
  charts,
}: {
  pair: Pair;
  record: TradeRecord | null;
  charts: boolean;
}) {
  // Fall back to the deterministic sample so the panel is never empty.
  const fallback = mockAnalysis(pair, new Date());
  const a = record ?? {
    ...fallback,
    timestamp: new Date().toISOString(),
    mock: true,
  };
  const tone = ACTION_TONE[a.action];
  const threshold = SEND_THRESHOLD[pair];

  return (
    <section className="glass noise relative overflow-hidden p-5 sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-scan-y bg-gradient-to-r from-transparent via-neon/60 to-transparent" />

      {/* head */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="num text-xl font-bold tracking-tight text-white">{pair}</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                tone.border,
                tone.bg
              )}
            >
              <LiveDot tone={tone.dot} />
              <span className={cn("text-2xs font-bold uppercase tracking-[0.16em]", tone.text)}>
                {a.action}
              </span>
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-silver-dim">
            <Clock className="h-3 w-3" strokeWidth={2.5} />
            {a.session} session · updated {ago(a.timestamp)}
            {a.mock && <span className="chip ml-1 py-0 text-[0.55rem]">sample data</span>}
          </p>
        </div>

        <div className="min-w-[180px] flex-1 sm:max-w-[260px]">
          <ConfidenceBar confidence={a.confidence} threshold={threshold} action={a.action} />
        </div>
      </div>

      {/* five-timeframe collage */}
      <div className="mt-6">
        <h3 className="eyebrow mb-2.5">Five timeframe read</h3>
        {charts ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/collage?pair=${pair}&headline=${encodeURIComponent(
              `${a.action} ${pair} — ${a.confidence}/100`
            )}`}
            alt={`${pair} Weekly, Daily, 4H, 1H and 15M charts`}
            className="w-full rounded-xl border border-line bg-black"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 bg-black/40 px-6 py-12 text-center">
            <Radio className="h-5 w-5 text-silver-deep" strokeWidth={2} />
            <p className="text-sm font-medium text-silver">Charts not generated yet</p>
            <p className="max-w-xs text-2xs text-silver-dim">
              Run <code className="rounded bg-black px-1.5 py-0.5 text-neon">python scripts/mt5_factory.py</code>{" "}
              to render the W / D / 4H / 1H / 15M images.
            </p>
          </div>
        )}
      </div>

      {/* score breakdown */}
      <div className="mt-6">
        <h3 className="eyebrow mb-2.5">Score breakdown</h3>
        <ScoreCards breakdown={a.score_breakdown} />
      </div>

      {/* reasoning */}
      <div className="mt-6 rounded-xl border border-line bg-black/50 p-4">
        <h3 className="eyebrow mb-2 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-neon" strokeWidth={2.2} />
          AI reasoning
        </h3>
        <p className="pretty text-sm leading-relaxed text-silver">{a.reason_taglish}</p>
        {a.action !== "WAIT" && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { k: "SL", v: a.sl, tone: "text-danger" },
              { k: "TP1", v: a.tp1, tone: "text-neon" },
              { k: "TP2", v: a.tp2, tone: "text-neon" },
            ].map((c) => (
              <div key={c.k} className="rounded-lg border border-line bg-black px-2.5 py-2">
                <div className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-silver-deep">
                  {c.k}
                </div>
                <div className={cn("num mt-0.5 text-sm font-bold", c.tone)}>{c.v ?? "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export default async function LivePage() {
  const store = await readHistory();
  const stats = getStats(store.rows);
  const pairs = PAIRS as readonly Pair[];

  const panels = await Promise.all(
    pairs.map(async (pair) => ({
      pair,
      record: latestFor(store.rows, pair),
      charts: await hasCharts(pair),
    }))
  );

  const headline = panels[0].record ?? mockAnalysis("XAUUSD", new Date());
  const headlineTone = ACTION_TONE[headline.action];

  return (
    <>
      <GridBackground />

      {/* ---- header (self-contained so the landing nav stays untouched) ---- */}
      <header className="sticky top-0 z-50 border-b border-line bg-black/70 backdrop-blur-xl">
        <div className="container flex h-[68px] items-center justify-between gap-4">
          <Logo href="/" priority />
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-ghost h-9 px-3.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="hidden sm:inline">Back to site</span>
            </Link>
            <Link
              href={site.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-neon h-9 px-3.5 text-xs"
            >
              🚀 Join Free Beta
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        {/* ---- live headline ---- */}
        <section className="container pt-12 sm:pt-16">
          <div
            className={cn(
              "inline-flex max-w-full items-center gap-2.5 rounded-full border py-1.5 pl-2.5 pr-4",
              headlineTone.border,
              headlineTone.bg
            )}
          >
            <LiveDot tone={headlineTone.dot} />
            <span className={cn("truncate text-2xs font-semibold sm:text-xs", headlineTone.text)}>
              LIVE: AI is{" "}
              <span className="font-bold">{HEADLINE_WORD[headline.action]}</span> on{" "}
              {headline.pair} <span className="num text-white">{headline.confidence}%</span>
            </span>
          </div>

          <h1 className="balance mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]">
            <span className="text-silver-metal">Live AI</span>{" "}
            <span className="text-neon-metal">Status.</span>
          </h1>
          <p className="pretty mt-5 max-w-2xl text-base leading-relaxed text-silver-dim sm:text-lg">
            Every hour the engine re-reads Weekly down to 15M on both markets and scores
            the confluence out of 100. Below is the most recent run — including the setups
            it decided <span className="font-medium text-warn">not</span> to take.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-2xs text-silver-dim">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-neon" strokeWidth={2.2} />
              Last run {ago(store.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-neon" strokeWidth={2.2} />
              XAUUSD sends at 85 · BTCUSD at 90
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-neon" strokeWidth={2.2} />
              Max 10 chart posts/day
            </span>
          </div>
        </section>

        {/* ---- pair panels ---- */}
        <section className="container mt-10 grid gap-5 lg:mt-14 lg:grid-cols-2 lg:gap-6">
          {panels.map((p) => (
            <PairPanel key={p.pair} pair={p.pair} record={p.record} charts={p.charts} />
          ))}
        </section>

        {/* ---- history ---- */}
        <section className="container mt-16 sm:mt-20">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Signal history
              </h2>
              <p className="mt-1.5 text-sm text-silver-dim">
                Every run recorded, outcomes verified automatically. Nothing hidden —
                including the losers.
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <span className="chip">
                last {stats.sampleSize} closed · {stats.pending} open
              </span>
              {storageBackend() !== "file" && (
                <span className="chip-neon" title="History is stored in Vercel KV and survives restarts">
                  durable
                </span>
              )}
            </span>
          </div>
          <History rows={store.rows} stats={stats} />
        </section>

        {/* ---- cta ---- */}
        <section className="container mt-16 sm:mt-20">
          <BetaCta telegram={site.telegram} />
        </section>

        {/* ---- disclaimer ---- */}
        <section className="container mb-16 mt-10">
          <p className="pretty text-center text-2xs leading-relaxed text-silver-deep">
            VISION MTF is an educational tool and technical-analysis software — not financial
            advice. Scores and reasoning shown are model output and may be wrong. Past
            performance does not guarantee future results.{" "}
            <span className="text-silver-dim">
              {site.name} © {site.year} by {site.legalName}.
            </span>
          </p>
        </section>
      </main>
    </>
  );
}
