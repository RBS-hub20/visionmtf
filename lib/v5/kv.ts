/**
 * VISION MTF — durable storage helper.
 *
 * Vercel KV when the connection env vars are present (production), falling
 * back to the local filesystem so `npm run dev` works with no KV at all.
 *
 * The @vercel/kv client is imported lazily: its singleton throws on first use
 * when unconfigured, and we do not want that to happen at module load in dev.
 */

export function kvEnabled(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  );
}

/** Which backend storage will actually use, for diagnostics. */
export function storageBackend(): "kv" | "file" {
  return kvEnabled() ? "kv" : "file";
}

type KvClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
};

let client: KvClient | null = null;

async function getClient(): Promise<KvClient | null> {
  if (!kvEnabled()) return null;
  if (client) return client;
  try {
    const mod = await import("@vercel/kv");
    client = mod.kv as unknown as KvClient;
    return client;
  } catch (err) {
    console.error("[v5/kv] client unavailable:", (err as Error).message);
    return null;
  }
}

/** Returns null when KV is disabled or the read fails — callers fall back. */
export async function kvGet<T>(key: string): Promise<T | null> {
  const c = await getClient();
  if (!c) return null;
  try {
    return await c.get<T>(key);
  } catch (err) {
    console.error(`[v5/kv] get ${key} failed:`, (err as Error).message);
    return null;
  }
}

/** Returns false when KV is disabled or the write fails. */
export async function kvSet(key: string, value: unknown): Promise<boolean> {
  const c = await getClient();
  if (!c) return false;
  try {
    await c.set(key, value);
    return true;
  } catch (err) {
    console.error(`[v5/kv] set ${key} failed:`, (err as Error).message);
    return false;
  }
}

export const KV_KEYS = {
  history: "v5:signals:history",
  chartBudget: "v5:chart:lastpost",
} as const;
