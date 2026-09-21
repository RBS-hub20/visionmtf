import { promises as fs } from "fs";
import path from "path";
import { EMPTY_HISTORY, type HistoryFile, type TradeRecord } from "./types";

/**
 * V5.4 history persistence.
 *
 * TODO(KV): on Vercel the deployment filesystem is READ-ONLY apart from /tmp,
 * and /tmp is per-instance and ephemeral. So history survives only as long as
 * a warm instance does — acceptable for the free beta, not for a real track
 * record. Move `readHistory`/`writeHistory` to Vercel KV (or Postgres) to make
 * it durable; they are the only two functions that touch storage.
 *
 *   - data/signals.json in the repo is the committed seed, always readable
 *   - at runtime on Vercel we write /tmp and prefer it on read
 *   - locally (npm run dev) we read and write data/signals.json directly
 */

const SEED_PATH = path.join(process.cwd(), "data", "signals.json");
const TMP_PATH = path.join("/tmp", "vision-mtf-signals.json");

const isServerless = Boolean(process.env.VERCEL);

/** WATCH rows are written every run, so keep a generous window. */
export const MAX_HISTORY = 400;

async function readJson(file: string): Promise<HistoryFile | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Partial<HistoryFile> & {
      signals?: unknown[];
    };
    if (Array.isArray(parsed.rows)) return parsed as HistoryFile;
    // pre-5.4 files had `signals` and an incompatible row shape — start clean
    if (Array.isArray(parsed.signals)) return EMPTY_HISTORY;
    return null;
  } catch {
    return null;
  }
}

export async function readHistory(): Promise<HistoryFile> {
  if (isServerless) {
    const runtime = await readJson(TMP_PATH);
    if (runtime) return runtime;
  }
  return (await readJson(SEED_PATH)) ?? EMPTY_HISTORY;
}

export async function writeHistory(data: HistoryFile): Promise<boolean> {
  const payload = JSON.stringify(
    { ...data, rows: data.rows.slice(0, MAX_HISTORY) },
    null,
    2
  );

  // Always try the repo path too: locally it IS the store, and on Vercel the
  // failed write is harmless and keeps one code path.
  const targets = isServerless ? [TMP_PATH, SEED_PATH] : [SEED_PATH];
  let wrote = false;
  for (const target of targets) {
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, payload, "utf8");
      wrote = true;
    } catch {
      // read-only on Vercel for SEED_PATH — expected
    }
  }
  if (!wrote) console.error("[v5/store] history write failed on every target");
  return wrote;
}

/** Prepend new rows, newest first, and stamp the file. */
export async function appendRows(
  newRows: TradeRecord[],
  existing?: TradeRecord[]
): Promise<HistoryFile> {
  const base = existing ?? (await readHistory()).rows;
  const next: HistoryFile = {
    version: "5.4",
    updatedAt: new Date().toISOString(),
    rows: [...newRows, ...base].slice(0, MAX_HISTORY),
  };
  await writeHistory(next);
  return next;
}

/** Replace the whole row set (used after outcome settlement). */
export async function saveRows(rows: TradeRecord[]): Promise<HistoryFile> {
  const next: HistoryFile = {
    version: "5.4",
    updatedAt: new Date().toISOString(),
    rows: rows.slice(0, MAX_HISTORY),
  };
  await writeHistory(next);
  return next;
}
