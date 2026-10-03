import { ai } from "./claude.js";
import rateLimit from "express-rate-limit";

const MODELS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = /429|quota|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i;

export async function generate(params) {
  let lastErr;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (e) {
        lastErr = e;
        if (!RETRYABLE.test(e.message)) throw e;
        await sleep(700 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

// Max 8 AI calls per minute per user, so one person can't burn the shared quota
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  validate: false,
  message: { error: "You're asking too fast. Wait a few seconds and try again." },
});

// Tiny in-memory cache, so repeated demo questions cost nothing
const cache = new Map();
export const cacheGet = (k) => {
  const hit = cache.get(k);
  if (hit && hit.exp > Date.now()) return hit.value;
  cache.delete(k);
  return null;
};
export const cacheSet = (k, value, ttlMs = 120_000) => {
  if (cache.size > 200) cache.clear();
  cache.set(k, { value, exp: Date.now() + ttlMs });
};

export const cacheClear = () => cache.clear();