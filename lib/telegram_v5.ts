import { buildCollage } from "./v5/charts";
import { canPostChart, recordChartPost } from "./v5/chart_budget";
import { TFS, type Analysis, type Pair } from "./v5/types";

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
  return {
    bot: Boolean(token()),
    public: Boolean(chatFor("public")),
    vip: Boolean(chatFor("vip")),
  };
}

function scoreLine(a: Analysis) {
  return TFS.map((tf) => `${tf}:${a.score_breakdown[tf] ?? 0}`).join(" ");
}

function confidenceDot(confidence: number, threshold: number) {
  if (confidence >= threshold) return "\u{1F7E2}";
  if (confidence >= threshold - 20) return "\u{1F7E1}";
  return "\u{1F534}";
}

const fmt = (n: number | null) => (n === null || !Number.isFinite(n) ? "—" : String(n));

/* ------------------------------------------------------------------ */
/*  Message bodies                                                     */
/* ------------------------------------------------------------------ */

export function signalText(a: Analysis, price: number | null, threshold: number) {
  return [
    `\u{1F680} VISION MTF V5 SIGNAL - ${a.pair}`,
    ``,
    `${a.action} ${a.pair} @ ${fmt(price)}`,
    `SL: ${fmt(a.sl)}   TP1: ${fmt(a.tp1)}   TP2: ${fmt(a.tp2)}`,
    `SCORE: ${a.confidence}/100 ${confidenceDot(a.confidence, threshold)}`,
    `MTF: ${scoreLine(a)}`,
    `Session: ${a.session}`,
    ``,
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

/** @deprecated V5.2 replaced this with sendMarketWatch (rate limited to 10/day). */
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
  return [
    `\u{1F512} VIP SIGNAL - ${a.pair}`,
    ``,
    `${a.action} ${a.pair} @ ${fmt(price)}`,
    ``,
    `Entry : ${fmt(price ?? null)}`,
    `SL    : ${fmt(a.sl)}`,
    `TP1   : ${fmt(a.tp1)}`,
    `TP2   : ${fmt(a.tp2)}`,
    `R     : ${riskReward(price, a.sl, a.tp1)}`,
    ``,
    `SCORE: ${a.confidence}/100 ${confidenceDot(a.confidence, threshold)}`,
    `MTF: ${scoreLine(a)}`,
    `Session: ${a.session}`,
    ``,
    `AI: ${a.reason_taglish}`,
    ``,
    `Risk 1% max. Move SL to break-even at 1R.`,
  ].join("\n");
}

/** "1 : 2.8" from entry/SL/TP, or an em dash when levels are missing. */
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
  threshold: number,
  options?: { prefix?: string }
): Promise<SendResult> {
  const prefix = options?.prefix ?? "";
  return broadcast(a.pair, `${a.action} ${a.pair} \u2014 ${a.confidence}/100`, {
    public: prefix + signalText(a, price, threshold),
    vip: prefix + vipSignalText(a, price, threshold),
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

export { canPostChart, recordChartPost };
