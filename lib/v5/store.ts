import { promises as fs } from "fs";
import path from "path";
import { KV_KEYS, kvEnabled, kvGet, kvSet, storageBackend } from "./kv";
import { EMPTY_HISTORY, type HistoryFile, type TradeRecord } from "./types";

/**
 * V5.6 history persistence — durable via Vercel KV.
 *
 * Production reads and writes Vercel KV, so history survives cold starts,
 * new instances and redeploys. When KV is not configured (local `npm run
 * dev`) it falls back to the filesystem exactly as before, so nothing extra
 * is needed to work on the project.
 *
 * Read order:  KV -> /tmp (serverless) -> data/signals.json (committed seed)
 * Write order: KV, and the local file too when not on Vercel.
 *
 * `readHistory` and `writeHistory` remain the only functions that touch
 * storage; stats and outcome settlement operate on plain arrays.
 */

const SEED_PATH = path.join(process.cwd(), "data", "signals.json");
const TMP_PATH = path.join("/tmp", "vision-mtf-signals.json");

const isServerless = Boolean(process.env.VERCEL);

/** WATCH rows are written every run, so keep a generous window. */
export const MAX_HISTORY = 400;

export { storageBackend };

function normalise(parsed: unknown): HistoryFile | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Partial<HistoryFile> & { signals?: unknown[] };
  if (Array.isArray(p.rows)) {
    return {
      version: "5.4",
      updatedAt: p.updatedAt ?? null,
      rows: p.rows as TradeRecord[],
    };
  }
  // pre-5.4 files had `signals` and an incompatible row shape — start clean
  if (Array.isArray(p.signals)) return EMPTY_HISTORY;
  return null;
}

async function readFile(file: string): Promise<HistoryFile | null> {
  try {
    return normalise(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    return null;
  }
}

export async function readHistory(): Promise<HistoryFile> {
  if (kvEnabled()) {
    const fromKv = normalise(await kvGet<unknown>(KV_KEYS.history));
    if (fromKv) return fromKv;
    // KV configured but empty or unreadable — fall through rather than
    // showing a blank dashboard when a seed exists.
  }
  if (isServerless) {
    const runtime = await readFile(TMP_PATH);
    if (runtime) return runtime;
  }
  return (await readFile(SEED_PATH)) ?? EMPTY_HISTORY;
}

export async function writeHistory(data: HistoryFile): Promise<boolean> {
  const trimmed: HistoryFile = { ...data, rows: data.rows.slice(0, MAX_HISTORY) };

  const wroteKv = await kvSet(KV_KEYS.history, trimmed);

  // Local file: the store in dev, a warm-instance cache in production.
  const payload = JSON.stringify(trimmed, null, 2);
  const targets = isServerless ? [TMP_PATH] : [SEED_PATH];
  let wroteFile = false;
  for (const target of targets) {
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, payload, "utf8");
      wroteFile = true;
    } catch {
      // read-only filesystem on Vercel — expected for anything but /tmp
    }
  }

  if (!wroteKv && !wroteFile) {
    console.error("[v5/store] history write failed on every backend");
    return false;
  }
  return true;
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
