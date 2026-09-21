import { promises as fs } from "fs";
import path from "path";

/**
 * Font bootstrap for sharp/librsvg.
 *
 * Vercel's serverless image ships no fonts, so every <text> in our generated
 * SVG rasterises as tofu boxes. fontconfig has to be pointed at the DejaVu
 * files bundled in assets/fonts, and it needs a writable cache dir, which on
 * Lambda is only /tmp.
 *
 * Must run BEFORE the first sharp render — fontconfig reads the environment
 * when it initialises.
 */

let ready: Promise<void> | null = null;

async function bootstrap() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  try {
    await fs.access(path.join(dir, "DejaVuSans.ttf"));
  } catch {
    console.error("[v5/fonts] assets/fonts missing — text may render as boxes");
    return;
  }

  // fontconfig needs somewhere writable for its cache
  const cache = "/tmp/fontconfig";
  try {
    await fs.mkdir(cache, { recursive: true });
  } catch {
    // read-only /tmp would be unusual; fontconfig degrades to no cache
  }

  process.env.FONTCONFIG_PATH = dir;
  process.env.FONTCONFIG_FILE = path.join(dir, "fonts.conf");
  process.env.XDG_CACHE_HOME = "/tmp";
}

/** Idempotent; safe to await on every render. */
export function ensureFonts(): Promise<void> {
  if (!ready) ready = bootstrap();
  return ready;
}

/** The family our SVGs ask for. Resolved by fonts.conf on the server. */
export const FONT_STACK = "DejaVu Sans, Helvetica, Arial, sans-serif";
