export function isRedisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function redisCommand<T>(command: Array<string | number>): Promise<T> {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });

  const body = (await response.json()) as { result?: T; error?: string };
  if (!response.ok || body.error) {
    throw new Error(body.error ?? `Upstash HTTP ${response.status}`);
  }

  return body.result as T;
}
