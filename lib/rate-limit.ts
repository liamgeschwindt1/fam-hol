// Simple in-memory rate limiter. Resets on server restart.
// For production, replace with Redis-backed implementation.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key     Unique key (e.g. IP address + action)
 * @param max     Maximum requests per window
 * @param windowMs  Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const window = store.get(key);

  if (!window || now >= window.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (window.count >= max) {
    return false;
  }

  window.count += 1;
  return true;
}
