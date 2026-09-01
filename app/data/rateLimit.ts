import { isRedisConfigured, redisCommand } from "@/app/data/redis";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const defaultLimit = 120;
const defaultWindowSeconds = 60;
const defaultRetryAfterSeconds = 30;

export async function checkRateLimit(
  ip: string,
  route: string,
  options: { limit?: number; windowSeconds?: number; retryAfterSeconds?: number } = {}
): Promise<RateLimitResult> {
  const limit = options.limit ?? defaultLimit;
  const windowSeconds = options.windowSeconds ?? defaultWindowSeconds;
  const retryAfterSeconds = options.retryAfterSeconds ?? defaultRetryAfterSeconds;

  if (!isRedisConfigured()) {
    return { allowed: true, limit, remaining: limit, retryAfterSeconds };
  }

  const key = `rate-limit:${route}:${ip}`;

  try {
    const created = await redisCommand<"OK" | null>(["SET", key, 1, "EX", windowSeconds, "NX"]);
    const count = created === "OK" ? 1 : await redisCommand<number>(["INCR", key]);

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds
    };
  } catch (error) {
    console.error("Rate limit Redis error", { route, ip, error });
    return { allowed: true, limit, remaining: limit, retryAfterSeconds };
  }
}
