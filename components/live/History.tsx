"use client";

import { useMemo, useState } from "react";
import { ExternalLink, TrendingUp, Target, Trophy, Activity } from "lucide-react";
import type { Stats } from "@/lib/v5/outcome_tracker";
import type { Pair, TradeRecord, TradeStatus } from "@/lib/v5/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Badges                                                             */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<TradeStatus, { label: string; cls: string }> = {
  PENDING: { label: "PENDING", cls: "border-warn/40 bg-warn/10 text-warn" },
  WIN: { label: "TP1 HIT", cls: "border-neon/40 bg-neon/10 text-neon" },
  LOSS: { label: "SL HIT", cls: "border-danger/40 bg-danger/10 text-danger" },
  BE: { label: "BE", cls: "border-line-2 bg-white/[0.04] text-silver-dim" },
};

function StatusBadge({ row }: { row: TradeRecord }) {
  // WATCH rows are observations, not trades — they have no outcome to show.
  if (row.type === "WATCH") {
    return (
      <span className="inline-flex items-center rounded-md border border-line-2 bg-white/[0.02] px-1.5 py-0.5 text-[0.6rem] font-semibold text-silver-deep">
        WATCH
      </span>
    );
  }
  const s = STATUS_STYLE[row.status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6rem] font-bold",
        s.cls
      )}
    >
      {row.status === "PENDING" && (
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-warn" />
      )}
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary cards                                                      */
/* ------------------------------------------------------------------ */

function SummaryCards({ stats }: { stats: Stats }) {
  const hasClosed = stats.closed > 0;
  const pipsPositive = stats.totalPips >= 0;

  const cards = [
    {
      icon: Trophy,
      label: "Win rate",
      value: hasClosed ? `${stats.winRate}%` : "—",
      sub: hasClosed
        ? `${stats.wins}W · ${stats.losses}L · ${stats.breakEven}BE of ${stats.closed} closed`
        : "no closed signals yet",
      tone: hasClosed && stats.winRate >= 50 ? "text-neon" : "text-white",
    },
    {
      icon: TrendingUp,
      label: "Total pips",
      value: hasClosed ? `${pipsPositive ? "+" : ""}${stats.totalPips}` : "—",
      sub: hasClosed
        ? `avg ${stats.avgR >= 0 ? "+" : ""}${stats.avgR}R per trade`
        : "awaiting first close",
      tone: !hasClosed ? "text-white" : pipsPositive ? "text-neon" : "text-danger",
    },
    {
      icon: Target,
      label: "Best performer",
      value: stats.bestPair ?? "—",
      sub: stats.bestSession ? `strongest session: ${stats.bestSession}` : "not enough data",
      tone: "text-white",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="glass noise relative overflow-hidden p-5">
          <div className="flex items-center gap-2">
            <c.icon className="h-4 w-4 text-neon" strokeWidth={2.2} />
            <span className="eyebrow">{c.label}</span>
          </div>
          <div className={cn("num mt-3 text-3xl font-bold leading-none", c.tone)}>
            {c.value}
          </div>
          <p className="mt-2 text-2xs text-silver-dim">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filters                                                            */
/* ------------------------------------------------------------------ */

type TypeFilter = "ALL" | "SIGNAL" | "WATCH";
type PairFilter = "ALL" | Pair;

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-black/50 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-2xs font-semibold transition-colors",
            value === o.key
              ? "bg-neon/15 text-neon shadow-[inset_0_0_0_1px_rgba(0,255,136,0.3)]"
              : "text-silver-dim hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */

function dubai(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const ACTION_CLS: Record<string, string> = {
  BUY: "text-neon",
  SELL: "text-danger",
  WAIT: "text-silver-dim",
};

const COLUMNS = [
  "Time (Dubai)",
  "Pair",
  "Type",
  "Action",
  "Conf",
  "Status",
  "Pips",
  "Chart",
];

export function History({ rows, stats }: { rows: TradeRecord[]; stats: Stats }) {
  const [type, setType] = useState<TypeFilter>("ALL");
  const [pair, setPair] = useState<PairFilter>("ALL");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (type === "ALL" || r.type === type) && (pair === "ALL" || r.pair === pair)
      ),
    [rows, type, pair]
  );

  return (
    <div className="flex flex-col gap-6">
      <SummaryCards stats={stats} />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Pills<TypeFilter>
          value={type}
          onChange={setType}
          options={[
            { key: "ALL", label: "All" },
            { key: "SIGNAL", label: "Signals only" },
            { key: "WATCH", label: "Market watch" },
          ]}
        />
        <Pills<PairFilter>
          value={pair}
          onChange={setPair}
          options={[
            { key: "ALL", label: "All pairs" },
            { key: "XAUUSD", label: "XAUUSD" },
            { key: "BTCUSD", label: "BTCUSD" },
          ]}
        />
        <span className="ml-auto text-2xs text-silver-dim">
          <span className="num text-silver">{filtered.length}</span> of{" "}
          <span className="num text-silver">{rows.length}</span> rows
        </span>
      </div>

      {/* table */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <Activity className="h-5 w-5 text-silver-deep" strokeWidth={2} />
          <p className="text-sm font-medium text-white">
            {rows.length === 0 ? "No runs recorded yet" : "Nothing matches these filters"}
          </p>
          <p className="max-w-sm text-2xs text-silver-dim">
            {rows.length === 0
              ? "The engine writes a row every hour. Trigger one now with /api/cron/analyze."
              : "Try widening the type or pair filter."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line bg-black/50">
                  {COLUMNS.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-silver-deep"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const pips = r.outcome?.pips;
                  const showPips =
                    r.type === "SIGNAL" &&
                    (r.status === "WIN" || r.status === "LOSS") &&
                    typeof pips === "number";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="num whitespace-nowrap px-3 py-2.5 text-2xs text-silver-dim">
                        {dubai(r.timestamp)}
                      </td>
                      <td className="num px-3 py-2.5 text-2xs font-bold text-white">
                        {r.pair}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "text-[0.6rem] font-bold",
                            r.type === "SIGNAL" ? "text-neon" : "text-silver-deep"
                          )}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "num px-3 py-2.5 text-2xs font-bold",
                          ACTION_CLS[r.action] ?? "text-silver"
                        )}
                      >
                        {r.action}
                      </td>
                      <td className="num px-3 py-2.5 text-2xs text-silver">
                        {r.confidence}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge row={r} />
                      </td>
                      <td
                        className={cn(
                          "num px-3 py-2.5 text-2xs font-bold",
                          !showPips
                            ? "text-silver-deep"
                            : pips! > 0
                              ? "text-neon"
                              : "text-danger"
                        )}
                      >
                        {showPips ? `${pips! > 0 ? "+" : ""}${pips}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <a
                          href={r.chartUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-2xs text-silver-dim transition-colors hover:text-neon"
                        >
                          View
                          <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-2xs leading-relaxed text-silver-deep">
        Outcomes are verified automatically against exchange candles printed after
        publication — first touch of SL or TP1 wins, and a bar spanning both is
        scored as a loss. Positions still open after 72h are settled at market.
        Chart links render the <span className="text-silver-dim">current</span>{" "}
        market, not a snapshot from the time of the signal.
      </p>
    </div>
  );
}
