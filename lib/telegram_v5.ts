import { buildCollage } from "./v5/charts";
import { canPostChart, recordChartPost } from "./v5/chart_budget";
import { TFS, TF_WEIGHT, type Analysis, type Pair } from "./v5/types";
import { formatPrice } from "./v5/market_data";

/**
 * VISION MTF V5.6 — dual-channel Telegram delivery.
 *
 * MARKET WATCH  -> PUBLIC channel only
 * SIGNAL        -> PUBLIC + VIP (VIP gets the full trade plan)
 *
 * Both senders post a collage of the five timeframe charts with the message as
 * the photo caption. If no charts exist yet they fall back to a text message,
 * so delivery never silently fails. The collage is rendered ONCE per call and
 * reused across channels.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_PUBLIC_CHANNEL_ID, TELEGRAM_VIP_CHANNEL_ID
 * TELEGRAM_CHANNEL_ID is still honoured as the public channel for
 * backwards-compatibility with the V5.2 single-channel setup.
 */

const API = "https://api.telegram.org";

export type Channel = "public" | "vip";

export type ChannelResult = {
  ok: boolean;
  skipped?: "no-credentials" | "not-configured";
  withCollage?: boolean;
  error?: string;
};

export type SendResult = ChannelResult & {
  /** Per-channel detail. `vip` is absent when no VIP channel is configured. */
  channels: Partial<Record<Channel, ChannelResult>>;
  deliveredPublic: boolean;
  deliveredVip: boolean;
};

function token() {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

function chatFor(channel: Channel): string | null {
  if (channel === "vip") return process.env.TELEGRAM_VIP_CHANNEL_ID ?? null;
  return (
    process.env.TELEGRAM_PUBLIC_CHANNEL_ID ??
    process.env.TELEGRAM_CHANNEL_ID ??
    null
  );
}

export function channelsConfigured() {
  const state = {
    bot: Boolean(token()),
    public: Boolean(chatFor("public")),
    vip: Boolean(chatFor("vip")),
  };
  if (!state.bot || !state.public) {
    console.warn(
      `[telegram_v5] telegram not configured (bot=${state.bot} public=${state.public} vip=${state.vip}) - sends will be skipped`
    );
  }
  return state;
}

function scoreLine(a: Analysis) {
  return TFS.map((tf) => `${tf}:${a.score_breakdown[tf] ?? 0}`).join(" ");
}

function confidenceDot(confidence: number, threshold: number) {
  if (confidence >= threshold) return "\u{1F7E2}";
  if (confidence >= threshold - 20) return "\u{1F7E1}";
  return "\u{1F534}";
}

const DASH = "\u2014";

const fmt = (n: number | null) => (n === null || !Number.isFinite(n) ? "—" : String(n));

/* ------------------------------------------------------------------ */
/*  Message bodies                                                     */
/* ------------------------------------------------------------------ */

export function signalText(a: Analysis, price: number | null, threshold: number) {
  const money = (v: number | null) =>
    v === null || !Number.isFinite(v) ? DASH : formatPrice(a.pair, v);
  return [
    a.momentum
      ? `\u26A1 MOMENTUM ${a.action} - ${a.pair}`
      : `\u{1F3AF} ${a.pair} ${a.action}`,
    ``,
    `Entry : ${money(price)}`,
    `SL    : ${money(a.sl)}`,
    `TP1   : ${money(a.tp1)}`,
    `TP2   : ${money(a.tp2)}`,
    `R     : ${riskReward(price, a.sl, a.tp1)}`,
    ``,
    `Confidence: ${a.confidence}% ${confidenceDot(a.confidence, threshold)}`,
    `Session: ${a.session}`,
    ``,
    ...(a.momentum ? [`\u26A1 ${a.momentum.reason}`, ``] : []),
    `AI: ${a.reason_taglish}`,
  ].join("\n");
}

export function marketWatchText(a: Analysis) {
  const direction = a.action === "SELL" ? "Premium" : "Discount";
  return [
    `\u23F3 VISION MTF - MARKET WATCH`,
    ``,
    `${a.pair} | Score: ${a.confidence}/100 | ${a.session}`,
    `Status: Waiting for ${direction}/BOS`,
    ``,
    `AI: ${a.reason_taglish}`,
    ``,
    `Next signal check: 60 mins`,
  ].join("\n");
}

export function noTradeText(a: Analysis) {
  return [
    `⏳ VISION MTF - NO TRADE UPDATE`,
    ``,
    `${a.pair} | Score: ${a.confidence}/100 \u{1F7E1} WAIT`,
    `Session: ${a.session}`,
    ``,
    `Bakit walang signal? ${a.reason_taglish}`,
    `Breakdown: ${scoreLine(a)}`,
    ``,
    `Next check 30 mins`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/*  Transport                                                          */
/* ------------------------------------------------------------------ */

/** Post one message to one channel, reusing a prebuilt collage. */
async function postTo(
  channel: Channel,
  text: string,
  collage: Buffer | null,
  filename: string
): Promise<ChannelResult> {
  const bot = token();
  const chat = chatFor(channel);
  if (!bot) return { ok: false, skipped: "no-credentials" };
  if (!chat) return { ok: false, skipped: "not-configured" };

  try {
    if (collage) {
      const form = new FormData();
      form.append("chat_id", chat);
      // Telegram caps photo captions at 1024 characters
      form.append("caption", text.slice(0, 1024));
      form.append(
        "photo",
        new Blob([new Uint8Array(collage)], { type: "image/png" }),
        filename
      );
      const res = await fetch(`${API}/bot${bot}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      if (res.ok) return { ok: true, withCollage: true };
      console.error(`[telegram_v5] ${channel} sendPhoto failed:`, await res.text());
    }

    const res = await fetch(`${API}/bot${bot}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `sendMessage ${res.status}: ${await res.text()}` };
    }
    return { ok: true, withCollage: false };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Render the collage once, then fan out to the requested channels.
 * `texts` supplies a per-channel caption so VIP can carry the full plan.
 */
async function broadcast(
  pair: Pair,
  headline: string,
  texts: Partial<Record<Channel, string>>
): Promise<SendResult> {
  let collage: Buffer | null = null;
  try {
    collage = await buildCollage(pair, headline);
  } catch (err) {
    console.error("[telegram_v5] collage failed:", (err as Error).message);
  }

  const channels: Partial<Record<Channel, ChannelResult>> = {};
  for (const channel of ["public", "vip"] as Channel[]) {
    const text = texts[channel];
    if (!text) continue;
    if (channel === "vip" && !chatFor("vip")) {
      // VIP not configured — that is a valid single-channel setup, not an error
      channels.vip = { ok: false, skipped: "not-configured" };
      continue;
    }
    channels[channel] = await postTo(channel, text, collage, `${pair}_mtf.png`);
  }

  const deliveredPublic = channels.public?.ok ?? false;
  const deliveredVip = channels.vip?.ok ?? false;

  return {
    ok: deliveredPublic || deliveredVip,
    withCollage: Boolean(collage),
    ...(channels.public?.skipped ? { skipped: channels.public.skipped } : {}),
    ...(channels.public?.error ? { error: channels.public.error } : {}),
    channels,
    deliveredPublic,
    deliveredVip,
  };
}

/** VIP caption — the full trade plan, gated behind the paid channel. */
export function vipSignalText(
  a: Analysis,
  price: number | null,
  threshold: number
) {
  const money = (v: number | null) =>
    v === null || !Number.isFinite(v) ? DASH : formatPrice(a.pair, v);
  const total = TFS.reduce((sum, tf) => sum + (a.score_breakdown[tf] ?? 0), 0);
  const breakdown = TFS.map(
    (tf) => `${tf.padEnd(3)} : ${a.score_breakdown[tf] ?? 0}/${TF_WEIGHT[tf]}`
  );
  return [
    `\u{1F512} VIP SIGNAL - ${a.pair} ${a.action}`,
    ``,
    `Entry : ${money(price)}`,
    `SL    : ${money(a.sl)}`,
    `TP1   : ${money(a.tp1)}`,
    `TP2   : ${money(a.tp2)}`,
    `R     : ${riskReward(price, a.sl, a.tp1)}`,
    ``,
    `MTF BREAKDOWN`,
    ...breakdown,
    `TOTAL : ${total}/100 ${confidenceDot(a.confidence, threshold)}`,
    ``,
    ...(a.momentum
      ? [
          `MOMENTUM DETECTED: ${a.momentum.direction}`,
          `Base    : ${a.momentum.baseConfidence}/100 (vision read)`,
          `Bonus   : +${a.momentum.score} (momentum)`,
          `Final   : ${a.confidence}/100`,
          `Triggers: ${a.momentum.triggers.join(", ")}`,
          `${a.momentum.reason}`,
          ``,
        ]
      : []),
    `Session: ${a.session}`,
    `AI: ${a.reason_taglish}`,
    ``,
    `Risk 1% max. Move SL to break-even at 1R.`,
  ].join("\n");
}

export function riskReward(
  entry: number | null,
  sl: number | null,
  tp: number | null
): string {
  if (entry === null || sl === null || tp === null) return "\u2014";
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return "\u2014";
  return `1 : ${(reward / risk).toFixed(1)}`;
}

/**
 * Broadcast a tradable setup.
 * PUBLIC gets the standard signal, VIP gets the full plan with R.
 */
export async function sendSignal(
  a: Analysis,
  price: number | null,
  threshold: number
): Promise<SendResult> {
  const tag = a.momentum ? "MOMENTUM " : "";
  return broadcast(a.pair, `${tag}${a.action} ${a.pair} \u2014 ${a.confidence}/100`, {
    public: signalText(a, price, threshold),
    vip: vipSignalText(a, price, threshold),
  });
}

/**
 * @deprecated V5.2 — superseded by {@link sendMarketWatch}.
 */
export async function sendNoTradeUpdate(a: Analysis): Promise<SendResult> {
  return broadcast(a.pair, `WAIT ${a.pair} \u2014 ${a.confidence}/100`, {
    public: noTradeText(a),
  });
}

/**
 * Low-priority chart update — PUBLIC channel only, never VIP.
 * Subject to the 10-a-day budget: call {@link canPostChart} first.
 */
export async function sendMarketWatch(a: Analysis): Promise<SendResult> {
  const res = await broadcast(
    a.pair,
    `MARKET WATCH ${a.pair} \u2014 ${a.confidence}/100`,
    { public: marketWatchText(a) }
  );
  if (res.deliveredPublic) await recordChartPost(a.pair);
  return res;
}

/* ------------------------------------------------------------------ */
/*  V5.6.8 — real-time TP/SL alerts                                    */
/* ------------------------------------------------------------------ */

export type AlertStats = {
  winRate: number;
  wins: number;
  losses: number;
  breakEven: number;
  closed: number;
  totalPips: number;
  avgR: number;
  bestPair: string | null;
  bestWinRate: number | null;
  bestSession: string | null;
};

export type OutcomeAlert = {
  pair: Pair;
  action: "BUY" | "SELL";
  kind: "tp1" | "tp2" | "sl";
  entry: number | null;
  level: number;
  price: number;
  pips: number;
  /** Realised R, shown on a closing hit. */
  r?: number | null;
  tp2?: number | null;
  stats?: AlertStats | null;
};

export const LIVE_URL = "visionmtf.vercel.app/live";

/** "42.9% WR (3W 4L) | +2326.3 pips | +0.29R avg" plus the best-pair line. */
export function statsBlock(stats: AlertStats | null | undefined, updated: boolean): string[] {
  if (!stats || stats.closed === 0) return [];
  const sign = (n: number) => (n >= 0 ? "+" : "");
  const record =
    `${stats.wins}W ${stats.losses}L` + (stats.breakEven ? ` ${stats.breakEven}BE` : "");
  const lines = [
    ``,
    `\u{1F4CA} ${updated ? "Updated" : "Stats"}: ${stats.winRate}% WR (${record}) | ` +
      `${sign(stats.totalPips)}${stats.totalPips} pips | ${sign(stats.avgR)}${stats.avgR}R avg`,
  ];
  if (stats.bestPair) {
    const wr = stats.bestWinRate !== null ? ` (${stats.bestWinRate}% WR)` : "";
    const ses = stats.bestSession ? ` - ${stats.bestSession} session` : "";
    lines.push(`\u{1F3C6} Best: ${stats.bestPair}${wr}${ses}`);
  }
  lines.push(``, LIVE_URL);
  return lines;
}

const ALERT_HEAD: Record<OutcomeAlert["kind"], string> = {
  tp1: "\u{1F3AF} TP1 HIT",
  tp2: "\u{1F3C6} TP2 HIT",
  sl: "\u{1F6D1} SL HIT",
};

export function outcomeAlertText(a: OutcomeAlert): string {
  const money = (v: number | null) =>
    v === null || !Number.isFinite(v) ? DASH : formatPrice(a.pair, v);
  const sign = a.pips >= 0 ? "+" : "";
  const closing = a.kind !== "tp1";
  const rSuffix =
    a.r !== undefined && a.r !== null && Number.isFinite(a.r)
      ? ` (${a.r >= 0 ? "+" : ""}${a.r}R)`
      : "";

  const head =
    a.kind === "tp1"
      ? `${ALERT_HEAD.tp1} - ${a.pair} ${a.action}`
      : a.kind === "tp2"
        ? `${ALERT_HEAD.tp2} - ${a.pair} ${a.action} - WIN CLOSED`
        : `${ALERT_HEAD.sl} - ${a.pair} ${a.action}`;

  const lines = [
    head,
    ``,
    `Entry : ${money(a.entry)}`,
    `${a.kind === "sl" ? "SL   " : a.kind.toUpperCase() + "  "} : ${money(a.level)}`,
  ];
  if (a.kind !== "sl") lines.push(`Now   : ${money(a.price)}`);
  lines.push(``, `${sign}${a.pips} pips${rSuffix}`);

  if (a.kind === "tp1" && a.tp2 != null) {
    lines.push(``, `Runner open to TP2 ${money(a.tp2)}. Move SL to BE.`);
  }
  if (a.kind === "tp2") lines.push(``, `Full target reached - trade closed.`);
  if (a.kind === "sl") lines.push(``, `Trade closed.`);

  lines.push(...statsBlock(a.stats, closing));
  return lines.join("\n");
}

/**
 * Broadcast a TP/SL hit to both channels. Text only: the collage is a
 * five-timeframe snapshot and would be stale by the time a level is touched,
 * and these need to arrive within minutes.
 */
export async function sendOutcomeAlert(a: OutcomeAlert): Promise<SendResult> {
  const text = outcomeAlertText(a);
  const channels: Partial<Record<Channel, ChannelResult>> = {};
  for (const channel of ["public", "vip"] as Channel[]) {
    if (channel === "vip" && !chatFor("vip")) {
      channels.vip = { ok: false, skipped: "not-configured" };
      continue;
    }
    channels[channel] = await postTo(channel, text, null, "");
  }
  const deliveredPublic = channels.public?.ok ?? false;
  const deliveredVip = channels.vip?.ok ?? false;
  return {
    ok: deliveredPublic || deliveredVip,
    channels,
    deliveredPublic,
    deliveredVip,
  };
}

/**
 * Daily summary, so the channel is never silent for a full day.
 * Public channel only — VIP already gets every signal.
 */
export async function sendDailySummary(opts: {
  stats: AlertStats;
  signalsLast24h: number;
  rowsScanned: number;
  targetWinRate?: number;
}): Promise<SendResult> {
  const { stats, signalsLast24h, rowsScanned } = opts;
  const target = opts.targetWinRate ?? 60;
  const sign = (n: number) => (n >= 0 ? "+" : "");
  const record =
    `${stats.wins}W ${stats.losses}L` + (stats.breakEven ? ` ${stats.breakEven}BE` : "");

  const lines = [
    `\u{1F4CA} VISION MTF - Daily Summary`,
    ``,
    `Last ${stats.closed} closed: ${record}`,
    `Win Rate: ${stats.winRate}%  ->  target ${target}%+`,
    `Total: ${sign(stats.totalPips)}${stats.totalPips} pips (${sign(stats.avgR)}${stats.avgR}R avg)`,
  ];
  if (stats.bestPair) {
    const wr = stats.bestWinRate !== null ? ` ${stats.bestWinRate}% WR` : "";
    const ses = stats.bestSession ? ` (${stats.bestSession})` : "";
    lines.push(`Best: ${stats.bestPair}${wr}${ses}`);
  }
  lines.push(
    ``,
    signalsLast24h === 0
      ? `No signals in the last 24h - market on watch. ${rowsScanned} rows scanned.`
      : `${signalsLast24h} signal${signalsLast24h === 1 ? "" : "s"} in the last 24h. ${rowsScanned} rows scanned.`,
    ``,
    LIVE_URL
  );

  const text = lines.join("\n");
  const channels: Partial<Record<Channel, ChannelResult>> = {
    public: await postTo("public", text, null, ""),
  };
  return {
    ok: channels.public?.ok ?? false,
    channels,
    deliveredPublic: channels.public?.ok ?? false,
    deliveredVip: false,
  };
}

export { canPostChart, recordChartPost };
