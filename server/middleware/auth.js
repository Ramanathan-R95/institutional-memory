import { supabase } from "../lib/supabase.js";

const cache = new Map(); // token -> { user, exp }
const TTL = 60_000;

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });

  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) { req.user = hit.user; return next(); }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error?.name === "AuthRetryableFetchError")
      return res.status(503).json({ error: "Auth service unreachable. Try again." });
    if (error || !data.user) return res.status(401).json({ error: "Invalid token" });

    const { data: profile } = await supabase
      .from("profiles").select("id, name, role, department_id").eq("id", data.user.id).single();
    if (!profile) return res.status(403).json({ error: "No profile for user" });

    const user = { ...profile, email: data.user.email };
    if (cache.size > 500) {
      for (const [k, v] of cache) if (v.exp < Date.now()) cache.delete(k);
      if (cache.size > 500) cache.clear();
    }
    cache.set(token, { user, exp: Date.now() + TTL });
    req.user = user;
    next();
  } catch (e) {
    console.error("Auth error:", e.message);
    res.status(503).json({ error: "Authentication service unavailable. Try again." });
  }
}