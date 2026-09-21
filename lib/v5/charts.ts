import { promises as fs } from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import {
  candleSourceLabel,
  dubaiStamp,
  fetchAllCandles,
  fetchSpot,
  formatPrice,
  type Spot,
} from "./market_data";
import { PANEL_H, PANEL_W, renderPanel } from "./render";
import { ensureFonts, FONT_STACK } from "./fonts";
import { TFS, TF_FILE, type Pair, type Tf } from "./types";

/**
 * VISION MTF V5.3 — chart panels + collage.
 *
 * Panels are rendered from LIVE candles (Binance / Yahoo GC=F). The
 * pre-rendered PNGs in public/charts/latest are only a fallback for when
 * every upstream feed is unreachable.
 */

export const CHART_DIR = path.join(process.cwd(), "public", "charts", "latest");

export function chartFile(pair: Pair, tf: Tf) {
  return path.join(CHART_DIR, `${pair}_${TF_FILE[tf]}.png`);
}

export function chartPublicPath(pair: Pair, tf: Tf) {
  return `/charts/latest/${pair}_${TF_FILE[tf]}.png`;
}

export type LoadedChart = { tf: Tf; buffer: Buffer };

export type ChartSet = {
  charts: LoadedChart[];
  spot: Spot | null;
  source: string;
  live: boolean;
};

/** Disk fallback — the committed mock PNGs. */
async function loadFromDisk(pair: Pair): Promise<LoadedChart[]> {
  const out: LoadedChart[] = [];
  for (const tf of TFS) {
    try {
      out.push({ tf, buffer: await fs.readFile(chartFile(pair, tf)) });
    } catch {
      // not generated — skip
    }
  }
  return out;
}

/**
 * Render the five timeframes from live data. Falls back to the committed
 * PNGs only if every feed fails.
 */
export async function loadChartSet(pair: Pair): Promise<ChartSet> {
  const source = candleSourceLabel(pair);
  const [series, spot] = await Promise.all([fetchAllCandles(pair), fetchSpot(pair)]);

  if (series.length > 0) {
    const charts = await Promise.all(
      series.map(async ({ tf, candles }) => ({
        tf,
        buffer: await renderPanel(candles, { pair, tf, source }),
      }))
    );
    return { charts, spot, source, live: true };
  }

  console.error(`[v5/charts] ${pair}: all live feeds failed, using disk PNGs`);
  return { charts: await loadFromDisk(pair), spot, source: "cached mock", live: false };
}

/** Back-compat: just the images. */
export async function loadCharts(pair: Pair): Promise<LoadedChart[]> {
  return (await loadChartSet(pair)).charts;
}

/* ------------------------------------------------------------------ */
/*  Collage                                                            */
/* ------------------------------------------------------------------ */

const CELL_W = PANEL_W;
const CELL_H = PANEL_H;
const LABEL_H = 34;
const PAD = 8;
const BANNER_H = 96;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function labelSvg(text: string, accent: string) {
  return Buffer.from(
    `<svg width="${CELL_W}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${CELL_W}" height="${LABEL_H}" fill="#0A0A0A"/>
       <rect x="0" y="${LABEL_H - 2}" width="${CELL_W}" height="2" fill="${accent}"/>
       <text x="14" y="23" font-family="${FONT_STACK}" font-size="17"
             font-weight="bold" fill="${accent}" letter-spacing="2">${esc(text)}</text>
     </svg>`
  );
}

/** Big live-price banner across the top of the collage. */
function bannerSvg(
  width: number,
  pair: Pair,
  spot: Spot | null,
  source: string,
  headline: string,
  live: boolean
) {
  const priceText = spot ? `${pair} LIVE: ${formatPrice(pair, spot.price)}` : `${pair} — price unavailable`;
  const stamp = dubaiStamp();
  const sub = live
    ? `${stamp}  ·  candles: ${source}${spot ? `  ·  spot: ${spot.source}` : ""}`
    : `${stamp}  ·  CACHED MOCK CANDLES — live feed unavailable`;

  return Buffer.from(
    `<svg width="${width}" height="${BANNER_H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${width}" height="${BANNER_H}" fill="#000000"/>
       <rect x="0" y="${BANNER_H - 2}" width="${width}" height="2" fill="#00FF88"/>
       <circle cx="26" cy="34" r="6" fill="${live ? "#00FF88" : "#FFB020"}"/>
       <text x="44" y="42" font-family="${FONT_STACK}" font-size="34"
             font-weight="bold" fill="#FFFFFF">${esc(priceText)}</text>
       <text x="44" y="70" font-family="${FONT_STACK}" font-size="15"
             fill="#8A8A8A">${esc(sub)}</text>
       <text x="${width - 20}" y="42" text-anchor="end" font-family="${FONT_STACK}"
             font-size="20" font-weight="bold" fill="#00FF88">VISION MTF V5</text>
       <text x="${width - 20}" y="70" text-anchor="end" font-family="${FONT_STACK}"
             font-size="15" fill="#C0C0C0">${esc(headline)}</text>
     </svg>`
  );
}

/**
 * 2-column collage of the five timeframes with a live-price banner on top.
 * Returns a PNG buffer, or null when there is nothing to compose.
 */
export async function buildCollage(
  pair: Pair,
  headline: string,
  preloaded?: ChartSet
): Promise<Buffer | null> {
  await ensureFonts();
  const set = preloaded ?? (await loadChartSet(pair));
  if (set.charts.length === 0) return null;

  const rows = Math.ceil(set.charts.length / 2);
  const cellH = CELL_H + LABEL_H;
  const width = CELL_W * 2 + PAD * 3;
  const height = BANNER_H + rows * cellH + PAD * (rows + 1);

  const composites: OverlayOptions[] = [
    { input: bannerSvg(width, pair, set.spot, set.source, headline, set.live), left: 0, top: 0 },
  ];

  for (let i = 0; i < set.charts.length; i++) {
    const { tf, buffer } = set.charts[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const left = PAD + col * (CELL_W + PAD);
    const top = BANNER_H + PAD + row * (cellH + PAD);

    const img = await sharp(buffer)
      .resize(CELL_W, CELL_H, { fit: "contain", background: "#000000" })
      .png()
      .toBuffer();

    composites.push({ input: labelSvg(`${pair}  ${tf}`, "#00FF88"), left, top });
    composites.push({ input: img, left, top: top + LABEL_H });
  }

  return sharp({
    create: { width, height, channels: 3, background: "#000000" },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
