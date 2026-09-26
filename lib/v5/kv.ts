/**
 * VISION MTF — durable storage helper.
 *
 * Supports BOTH shapes a Vercel KV / Redis store can arrive in:
 *
 *   1. REST  — KV_REST_API_URL + KV_REST_API_TOKEN, used by @vercel/kv.
 *              This is the legacy Vercel KV integration.
 *   2. Redis — KV_REDIS_URL (or REDIS_URL / KV_URL), a redis:// or rediss://
 *              connection string. This is what the current Vercel Marketplace
 *              Redis integration provisions, and it does NOT come with REST
 *              credentials, so @vercel/kv alone cannot see it.
 *
 * Falls back to the local filesystem when neither is configured, so
 * `npm run dev` works with no database at all.
 *
 * Clients are created lazily and cached on the module, so a warm serverless
 * instance reuses one connection instead of dialling per request.
 */

type Backend = "kv-rest" | "redis" | "file";

function restConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function redisUrl(): string | null {
  const url =
    process.env.KV_REDIS_URL ?? process.env.REDIS_URL ?? process.env.KV_URL;
  // KV_URL is redis:// on the Redis integration but unused by @vercel/kv
  if (!url) return null;
  return /^rediss?:\/\//.test(url) ? url : null;
}

export function storageBackend(): Backend {
  if (restConfigured()) return "kv-rest";
  if (redisUrl()) return "redis";
  return "file";
}

export function kvEnabled(): boolean {
  return storageBackend() !== "file";
}

/* ------------------------------------------------------------------ */
/*  Clients                                                            */
/* ------------------------------------------------------------------ */

type RestClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
};

let restClient: RestClient | null = null;

async function getRest(): Promise<RestClient | null> {
  if (!restConfigured()) return null;
  if (restClient) return restClient;
  try {
    const mod = await import("@vercel/kv");
    restClient = mod.kv as unknown as RestClient;
    return restClient;
  } catch (err) {
    console.error("[v5/kv] @vercel/kv unavailable:", (err as Error).message);
    return null;
  }
}

type RedisLike = {
  isOpen: boolean;
  connect(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  on(event: string, cb: (e: unknown) => void): unknown;
};

let redisClient: RedisLike | null = null;

async function getRedis(): Promise<RedisLike | null> {
  const url = redisUrl();
  if (!url) return null;
  try {
    if (!redisClient) {
      const { createClient } = await import("redis");
      redisClient = createClient({
        url,
        socket: { connectTimeout: 8000, reconnectStrategy: (n) => (n > 2 ? false : 200) },
      }) as unknown as RedisLike;
      // an unhandled 'error' event would crash the lambda
      redisClient.on("error", (e) =>
        console.error("[v5/kv] redis error:", (e as Error)?.message ?? e)
      );
    }
    if (!redisClient.isOpen) await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.error("[v5/kv] redis connect failed:", (err as Error).message);
    redisClient = null;
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */

/** Returns null when storage is disabled or the read fails — callers fall back. */
export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const rest = await getRest();
    if (rest) return await rest.get<T>(key);

    const redis = await getRedis();
    if (redis) {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
  } catch (err) {
    console.error(`[v5/kv] get ${key} failed:`, (err as Error).message);
  }
  return null;
}

/** Returns false when storage is disabled or the write fails. */
export async function kvSet(key: string, value: unknown): Promise<boolean> {
  try {
    const rest = await getRest();
    if (rest) {
      await rest.set(key, value);
      return true;
    }

    const redis = await getRedis();
    if (redis) {
      await redis.set(key, JSON.stringify(value));
      return true;
    }
  } catch (err) {
    console.error(`[v5/kv] set ${key} failed:`, (err as Error).message);
  }
  return false;
}

export const KV_KEYS = {
  history: "v5:signals:history",
  chartBudget: "v5:chart:lastpost",
} as const;
