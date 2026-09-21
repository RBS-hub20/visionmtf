import sharp from "sharp";
import { ensureFonts, FONT_STACK } from "./fonts";
import type { Candle } from "./market_data";
import type { Pair, Tf } from "./types";

/**
 * VISION MTF V5.3 — server-side candlestick rendering.
 *
 * Draws clean SMC charts (candles + wicks + last-price tag only, no
 * indicators) as SVG, then rasterises with sharp. Replaces the pre-rendered
 * mock PNGs from scripts/mt5_factory.py so the collage always shows the
 * real, current market.
 */

export const PANEL_W = 800;
export const PANEL_H = 500;

const BG = "#050505";
const GRID = "#141414";
const UP = "#00FF88";
const DOWN = "#FF5C5C";
const TEXT = "#C0C0C0";
const DIM = "#4A4A4A";
const TAG = "#FFB020";

const PAD_L = 8;
const PAD_R = 78; // room for the price axis
const PAD_T = 34;
const PAD_B = 26;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max; v += step) out.push(v);
  return out;
}

function fmtPrice(v: number): string {
  const digits = v >= 1000 ? 0 : 2;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtTime(t: number, tf: Tf): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  if (tf === "W" || tf === "D") {
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  }
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** One timeframe panel as an SVG string. */
export function candleChartSvg(
  candles: Candle[],
  opts: { pair: Pair; tf: Tf; source: string; width?: number; height?: number }
): string {
  const W = opts.width ?? PANEL_W;
  const H = opts.height ?? PANEL_H;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const lo = Math.min(...candles.map((c) => c.l));
  const hi = Math.max(...candles.map((c) => c.h));
  const pad = (hi - lo) * 0.06 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const y = (v: number) => PAD_T + plotH * (1 - (v - yMin) / (yMax - yMin));
  const slot = plotW / candles.length;
  const bodyW = Math.max(1.2, Math.min(9, slot * 0.62));
  const x = (i: number) => PAD_L + slot * (i + 0.5);

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

  // horizontal grid + price axis
  for (const t of niceTicks(yMin, yMax)) {
    const py = y(t);
    parts.push(`<line x1="${PAD_L}" y1="${py.toFixed(1)}" x2="${W - PAD_R}" y2="${py.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
    parts.push(`<text x="${W - PAD_R + 6}" y="${(py + 3.5).toFixed(1)}" font-family="${FONT_STACK}" font-size="11" fill="${DIM}">${fmtPrice(t)}</text>`);
  }

  // candles
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const up = c.c >= c.o;
    const col = up ? UP : DOWN;
    const cx = x(i);
    const yo = y(c.o);
    const yc = y(c.c);
    const top = Math.min(yo, yc);
    const h = Math.max(1, Math.abs(yc - yo));
    parts.push(`<line x1="${cx.toFixed(1)}" y1="${y(c.h).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${y(c.l).toFixed(1)}" stroke="${col}" stroke-width="1" opacity="0.85"/>`);
    parts.push(`<rect x="${(cx - bodyW / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${h.toFixed(1)}" fill="${up ? col : BG}" stroke="${col}" stroke-width="1"/>`);
  }

  // last price line + tag
  const last = candles[candles.length - 1].c;
  const ly = y(last);
  parts.push(`<line x1="${PAD_L}" y1="${ly.toFixed(1)}" x2="${W - PAD_R}" y2="${ly.toFixed(1)}" stroke="${TAG}" stroke-width="1" stroke-dasharray="4 4" opacity="0.85"/>`);
  parts.push(`<rect x="${W - PAD_R + 2}" y="${(ly - 9).toFixed(1)}" width="70" height="18" rx="3" fill="${TAG}"/>`);
  parts.push(`<text x="${W - PAD_R + 37}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-family="${FONT_STACK}" font-size="11.5" font-weight="bold" fill="#000">${fmtPrice(last)}</text>`);

  // header + footer
  parts.push(`<text x="${PAD_L + 6}" y="22" font-family="${FONT_STACK}" font-size="15" font-weight="bold" fill="#FFFFFF">${esc(opts.pair)}  ${esc(opts.tf)}</text>`);
  parts.push(`<text x="${W - PAD_R}" y="22" text-anchor="end" font-family="${FONT_STACK}" font-size="10" fill="${DIM}">${esc(opts.source)}</text>`);
  parts.push(`<text x="${PAD_L + 6}" y="${H - 8}" font-family="${FONT_STACK}" font-size="10" fill="${DIM}">${esc(fmtTime(candles[0].t, opts.tf))}</text>`);
  parts.push(`<text x="${W - PAD_R}" y="${H - 8}" text-anchor="end" font-family="${FONT_STACK}" font-size="10" fill="${TEXT}">${esc(fmtTime(candles[candles.length - 1].t, opts.tf))} UTC</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

/** Rasterise one panel to PNG. */
export async function renderPanel(
  candles: Candle[],
  opts: { pair: Pair; tf: Tf; source: string }
): Promise<Buffer> {
  await ensureFonts();
  return sharp(Buffer.from(candleChartSvg(candles, opts))).png().toBuffer();
}
