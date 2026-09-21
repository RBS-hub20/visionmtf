import { promises as fs } from "fs";
import path from "path";
import { EMPTY_SIGNALS, type SignalsFile, type SignalRecord } from "./types";

/**
 * Signal persistence.
 *
 * IMPORTANT: on Vercel the deployment filesystem is READ-ONLY apart from /tmp,
 * and /tmp is per-instance and ephemeral. So:
 *
 *   - `data/signals.json` in the repo is the committed seed. Always readable.
 *   - At runtime on Vercel we write to /tmp and read it back in preference.
 *   - Locally (`npm run dev`) we read and write `data/signals.json` directly,
 *     so history genuinely accumulates.
 *
 * This keeps the cron route and /live working everywhere, but history on Vercel
 * survives only as long as the warm instance does. For durable history swap
 * `readSignals`/`writeSignals` for Vercel KV, Blob or Postgres — those are the
 * only two functions that touch storage.
 */

const SEED_PATH = path.join(process.cwd(), "data", "signals.json");
const TMP_PATH = path.join("/tmp", "vision-mtf-signals.json");

const isServerless = Boolean(process.env.VERCEL);

export const MAX_HISTORY = 200;

async function readJson(file: string): Promise<SignalsFile | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as SignalsFile;
    if (!parsed || !Array.isArray(parsed.signals)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readSignals(): Promise<SignalsFile> {
  if (isServerless) {
    const runtime = await readJson(TMP_PATH);
    if (runtime) return runtime;
  }
  return (await readJson(SEED_PATH)) ?? EMPTY_SIGNALS;
}

export async function writeSignals(data: SignalsFile): Promise<boolean> {
  const payload = JSON.stringify(
    { ...data, signals: data.signals.slice(0, MAX_HISTORY) },
    null,
    2
  );
  const target = isServerless ? TMP_PATH : SEED_PATH;
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, payload, "utf8");
    return true;
  } catch (err) {
    console.error("[v5/store] write failed:", (err as Error).message);
    return false;
  }
}

/** Prepend new records, newest first, and stamp the file. */
export async function appendSignals(
  records: SignalRecord[],
  lastWaitUpdateAt: SignalsFile["lastWaitUpdateAt"]
): Promise<SignalsFile> {
  const current = await readSignals();
  const next: SignalsFile = {
    version: 5,
    updatedAt: new Date().toISOString(),
    lastWaitUpdateAt: { ...current.lastWaitUpdateAt, ...lastWaitUpdateAt },
    signals: [...records, ...current.signals].slice(0, MAX_HISTORY),
  };
  await writeSignals(next);
  return next;
}
