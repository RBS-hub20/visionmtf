import { promises as fs } from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import { TFS, TF_FILE, type Pair, type Tf } from "./types";

/**
 * Chart image access + collage building.
 * Charts are produced by scripts/mt5_factory.py into public/charts/latest/.
 */

export const CHART_DIR = path.join(process.cwd(), "public", "charts", "latest");

export function chartFile(pair: Pair, tf: Tf) {
  return path.join(CHART_DIR, `${pair}_${TF_FILE[tf]}.png`);
}

export function chartPublicPath(pair: Pair, tf: Tf) {
  return `/charts/latest/${pair}_${TF_FILE[tf]}.png`;
}

export type LoadedChart = { tf: Tf; buffer: Buffer };

/** Read all five timeframe images for a pair. Missing files are skipped. */
export async function loadCharts(pair: Pair): Promise<LoadedChart[]> {
  const out: LoadedChart[] = [];
  for (const tf of TFS) {
    try {
      out.push({ tf, buffer: await fs.readFile(chartFile(pair, tf)) });
    } catch {
      // chart not generated yet — the model simply sees fewer images
    }
  }
  return out;
}

const COLLAGE_W = 1600;
const CELL_W = 800;
const CELL_H = 500;
const LABEL_H = 34;
const PAD = 8;

function labelSvg(text: string, accent: string) {
  return Buffer.from(
    `<svg width="${CELL_W}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${CELL_W}" height="${LABEL_H}" fill="#0A0A0A"/>
       <rect x="0" y="${LABEL_H - 2}" width="${CELL_W}" height="2" fill="${accent}"/>
       <text x="14" y="23" font-family="Helvetica,Arial,sans-serif" font-size="17"
             font-weight="bold" fill="${accent}" letter-spacing="2">${text}</text>
     </svg>`
  );
}

/**
 * Build a 2-column collage of the five timeframes (last cell is the header
 * strip). Returns a PNG buffer, or null when there is nothing to compose.
 */
export async function buildCollage(
  pair: Pair,
  headline: string
): Promise<Buffer | null> {
  const charts = await loadCharts(pair);
  if (charts.length === 0) return null;

  const rows = Math.ceil((charts.length + 1) / 2);
  const cellH = CELL_H + LABEL_H;
  const height = rows * cellH + PAD * (rows + 1);

  const composites: OverlayOptions[] = [];

  for (let i = 0; i < charts.length; i++) {
    const { tf, buffer } = charts[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const left = PAD + col * (CELL_W + PAD);
    const top = PAD + row * (cellH + PAD);

    const img = await sharp(buffer)
      .resize(CELL_W, CELL_H, { fit: "contain", background: "#000000" })
      .png()
      .toBuffer();

    composites.push({ input: labelSvg(`${pair}  ${tf}`, "#00FF88"), left, top });
    composites.push({ input: img, left, top: top + LABEL_H });
  }

  // headline occupies the trailing empty cell
  const i = charts.length;
  const col = i % 2;
  const row = Math.floor(i / 2);
  const wrapped = headline.length > 74 ? `${headline.slice(0, 71)}...` : headline;
  composites.push({
    input: Buffer.from(
      `<svg width="${CELL_W}" height="${cellH}" xmlns="http://www.w3.org/2000/svg">
         <rect width="${CELL_W}" height="${cellH}" fill="#0A0A0A"/>
         <text x="${CELL_W / 2}" y="${cellH / 2 - 16}" text-anchor="middle"
               font-family="Helvetica,Arial,sans-serif" font-size="30" font-weight="bold"
               fill="#FFFFFF">VISION MTF V5</text>
         <text x="${CELL_W / 2}" y="${cellH / 2 + 22}" text-anchor="middle"
               font-family="Helvetica,Arial,sans-serif" font-size="19" fill="#00FF88">${escapeXml(
                 wrapped
               )}</text>
       </svg>`
    ),
    left: PAD + col * (CELL_W + PAD),
    top: PAD + row * (cellH + PAD),
  });

  return sharp({
    create: {
      width: COLLAGE_W + PAD * 3,
      height,
      channels: 3,
      background: "#000000",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
