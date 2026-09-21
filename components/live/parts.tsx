import Link from "next/link";
import { TFS, TF_WEIGHT, type Action, type SignalRecord, type Tf } from "@/lib/v5/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Action styling — shared by badges, rows and panels                 */
/* ------------------------------------------------------------------ */

export const ACTION_TONE: Record<Action, { text: string; border: string; bg: string; dot: string }> = {
  BUY: {
    text: "text-neon",
    border: "border-neon/35",
    bg: "bg-neon/[0.08]",
    dot: "bg-neon",
  },
  SELL: {
    text: "text-danger",
    border: "border-danger/35",
    bg: "bg-danger/[0.08]",
    dot: "bg-danger",
  },
  WAIT: {
    text: "text-warn",
    border: "border-warn/35",
    bg: "bg-warn/[0.08]",
    dot: "bg-warn",
  },
};

/** Pulsing live dot, matching the landing-page badge. */
export function LiveDot({ tone = "bg-neon" }: { tone?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-70 animate-pulse-ring", tone)} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", tone)} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeframe score cards — same visual language as the landing cards  */
/* ------------------------------------------------------------------ */

export function ScoreCards({ breakdown }: { breakdown: Record<Tf, number> }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
      {TFS.map((tf) => {
        const max = TF_WEIGHT[tf];
        const got = breakdown[tf] ?? 0;
        const pct = Math.round((got / max) * 100);
        const strong = pct >= 80;
        const mid = pct >= 50 && pct < 80;
        return (
          <div
            key={tf}
            className={cn(
              "card relative overflow-hidden px-1.5 py-2.5 text-center sm:px-3 sm:py-3.5",
              strong && "border-neon/35",
              mid && "border-warn/30"
            )}
          >
            <div
              className={cn(
                "num text-[0.6rem] font-bold tracking-wider sm:text-2xs",
                strong ? "text-neon" : mid ? "text-warn" : "text-silver-dim"
              )}
            >
              {tf}
            </div>
            <div className="num mt-1 text-base font-bold text-white sm:text-xl">
              {got}
              <span className="text-[0.6rem] font-medium text-silver-deep">/{max}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black">
              <div
                className={cn(
                  "h-full rounded-full",
                  strong ? "bg-neon" : mid ? "bg-warn" : "bg-silver-deep"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confidence bar with the send threshold marked                      */
/* ------------------------------------------------------------------ */

export function ConfidenceBar({
  confidence,
  threshold,
  action,
}: {
  confidence: number;
  threshold: number;
  action: Action;
}) {
  const tone = ACTION_TONE[action];
  return (
    <div>
      <div className="flex items-end justify-between text-2xs text-silver-dim">
        <span>Confidence</span>
        <span className="num font-semibold text-neon">send at {threshold}%</span>
      </div>
      <div className="relative mt-2 h-3.5 overflow-hidden rounded-full border border-line bg-black">
        <div
          className={cn(
            "h-full rounded-full",
            action === "WAIT"
              ? "bg-gradient-to-r from-warn/30 via-warn/60 to-warn/80"
              : action === "BUY"
                ? "bg-gradient-to-r from-neon/30 via-neon/60 to-neon"
                : "bg-gradient-to-r from-danger/30 via-danger/60 to-danger"
          )}
          style={{ width: `${Math.max(2, Math.min(100, confidence))}%` }}
        />
        <div
          className="absolute inset-y-0 w-[2px] bg-neon shadow-[0_0_12px_2px_rgba(0,255,136,0.9)]"
          style={{ left: `${threshold}%` }}
        />
      </div>
      <div className={cn("num mt-2 text-2xl font-bold", tone.text)}>
        {confidence}
        <span className="text-sm text-silver-dim">/100</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Signal history                                                     */
/* ------------------------------------------------------------------ */

function when(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

export function HistoryTable({ rows }: { rows: SignalRecord[] }) {
  if (rows.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
        <LiveDot tone="bg-warn" />
        <p className="mt-1 text-sm font-medium text-white">No runs recorded yet</p>
        <p className="max-w-sm text-2xs text-silver-dim">
          The engine writes a row every 30 minutes. Trigger one now with{" "}
          <code className="rounded bg-black px-1.5 py-0.5 text-neon">/api/cron/analyze</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-line bg-black/50">
              {["Time (UTC)", "Pair", "Action", "Score", "W", "D", "4H", "H1", "15M", "Session", "Sent"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-silver-deep"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tone = ACTION_TONE[r.action];
              return (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="num whitespace-nowrap px-3 py-2.5 text-2xs text-silver-dim">{when(r.ts)}</td>
                  <td className="num px-3 py-2.5 text-2xs font-bold text-white">{r.pair}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[0.6rem] font-bold",
                        tone.border,
                        tone.bg,
                        tone.text
                      )}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className={cn("num px-3 py-2.5 text-2xs font-bold", tone.text)}>{r.confidence}</td>
                  {TFS.map((tf) => (
                    <td key={tf} className="num px-3 py-2.5 text-2xs text-silver">
                      {r.score_breakdown[tf] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-2xs text-silver-dim">{r.session}</td>
                  <td className="px-3 py-2.5 text-2xs">
                    {r.delivered ? (
                      <span className="text-neon">✓</span>
                    ) : (
                      <span className="text-silver-deep">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function BetaCta({ telegram }: { telegram: string }) {
  return (
    <div className="glass noise edge-top flex flex-col items-center gap-5 overflow-hidden px-6 py-10 text-center sm:px-10 sm:py-12">
      <h2 className="balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Want these signals live in Telegram?
      </h2>
      <p className="pretty max-w-lg text-sm leading-relaxed text-silver-dim sm:text-base">
        Every WAIT and every EXECUTE, pushed the moment the engine scores it — with the
        full five-timeframe collage attached.
      </p>
      <Link
        href={telegram}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-neon min-h-[3rem] whitespace-normal px-6 py-2.5 text-center leading-snug"
      >
        🚀 Join Free Beta - No Card Needed
      </Link>
    </div>
  );
}
