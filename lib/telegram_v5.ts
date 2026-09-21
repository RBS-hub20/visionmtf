import { buildCollage } from "./v5/charts";
import { TFS, type Analysis, type Pair } from "./v5/types";

/**
 * VISION MTF V5 — Telegram delivery.
 *
 * Both senders post a collage of the five timeframe charts with the message as
 * the photo caption. If no charts exist yet they fall back to a text message,
 * so delivery never silently fails.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
 */

const API = "https://api.telegram.org";

export type SendResult = {
  ok: boolean;
  skipped?: "no-credentials";
  withCollage?: boolean;
  error?: string;
};

function credentials() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chat) return null;
  return { token, chat };
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

async function post(
  pair: Pair,
  text: string,
  headline: string
): Promise<SendResult> {
  const creds = credentials();
  if (!creds) return { ok: false, skipped: "no-credentials" };

  let collage: Buffer | null = null;
  try {
    collage = await buildCollage(pair, headline);
  } catch (err) {
    console.error("[telegram_v5] collage failed:", (err as Error).message);
  }

  try {
    if (collage) {
      const form = new FormData();
      form.append("chat_id", creds.chat);
      // Telegram caps photo captions at 1024 characters
      form.append("caption", text.slice(0, 1024));
      form.append(
        "photo",
        new Blob([new Uint8Array(collage)], { type: "image/png" }),
        `${pair}_mtf.png`
      );
      const res = await fetch(`${API}/bot${creds.token}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      if (res.ok) return { ok: true, withCollage: true };
      console.error("[telegram_v5] sendPhoto failed:", await res.text());
    }

    const res = await fetch(`${API}/bot${creds.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: creds.chat,
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

/** Broadcast a tradable setup. */
export async function sendSignal(
  a: Analysis,
  price: number | null,
  threshold: number
): Promise<SendResult> {
  return post(
    a.pair,
    signalText(a, price, threshold),
    `${a.action} ${a.pair} — ${a.confidence}/100`
  );
}

/** Broadcast the periodic "still waiting, here is why" update. */
export async function sendNoTradeUpdate(a: Analysis): Promise<SendResult> {
  return post(a.pair, noTradeText(a), `WAIT ${a.pair} — ${a.confidence}/100`);
}
