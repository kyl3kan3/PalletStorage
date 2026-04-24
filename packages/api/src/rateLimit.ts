import { TRPCError } from "@trpc/server";

/**
 * Tiny fixed-window rate limiter, keyed by arbitrary string (usually
 * orgId or clerkUserId). Intended as a blast-radius guard, not a fair
 * queueing system — for horizontal scale swap this module for
 * @upstash/ratelimit or similar.
 */
interface Bucket {
  windowStart: number; // epoch ms
  count: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export interface RateLimitOpts {
  /** Window length in ms. Default: 60_000 (1 minute). */
  windowMs?: number;
  /** Max requests allowed per key per window. Default: 120. */
  max?: number;
}

export function rateLimit(key: string, opts: RateLimitOpts = {}): void {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 120;
  const now = Date.now();

  // Opportunistic eviction to avoid unbounded memory growth in long-lived
  // processes with high key churn.
  if (now - lastSweep >= windowMs) {
    for (const [k, bucket] of buckets.entries()) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(k);
    }
    lastSweep = now;
  }

  let b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    b = { windowStart: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded (${max}/${Math.round(windowMs / 1000)}s)`,
    });
  }
}

/** For tests. */
export function __resetRateLimit(): void {
  buckets.clear();
  lastSweep = 0;
}
