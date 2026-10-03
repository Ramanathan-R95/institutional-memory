import { ai } from "./claude.js";
import { supabase } from "./supabase.js";
import { cacheGet, cacheSet } from "./gemini.js";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const DIMS = 1536; // must match vector(1536)
const MIN_SIMILARITY = 0.45;
const isStaff = (u) => ["admin", "faculty"].includes(u.role);

export async function embedMany(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const res = await ai.models.embedContent({
    model: EMBED_MODEL, contents: texts, config: { taskType, outputDimensionality: DIMS },
  });
  return res.embeddings.map((e) => e.values);
}
export const embedText = async (text, taskType) => (await embedMany([text], taskType))[0];
export const itemText = (k) => `${k.title}. ${k.kind}. ${k.content}`;

async function queryVector(query) {
  const key = `emb:${query.toLowerCase()}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  const v = await embedText(query, "RETRIEVAL_QUERY");
  cacheSet(key, v, 600_000);
  return v;
}

export async function semanticSearch(query, user, limit = 6) {
  const vector = await queryVector(query);
  const { data, error } = await supabase.rpc("match_knowledge", { query_embedding: vector, match_count: 15 });
  if (error) throw new Error(error.message);
  return data
    .filter((r) => r.similarity >= MIN_SIMILARITY)
    .filter((r) => isStaff(user) || ["project", "procedure"].includes(r.kind))
    .slice(0, limit);
}

export async function keywordSearch(query, user, limit = 6) {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3).slice(0, 6); // [a-z0-9_] only, so filter-safe
  if (!words.length) return [];
  let q = supabase.from("knowledge_items")
    .select("id, kind, title, content, year, faculty_guide")
    .or(words.flatMap((w) => [`title.ilike.%${w}%`, `content.ilike.%${w}%`]).join(","))
    .limit(limit);
  if (!isStaff(user)) q = q.in("kind", ["project", "procedure"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

// Meaning-based first; falls back to keywords if Gemini is rate-limited or down
export async function smartSearch(query, user, limit = 6) {
  try {
    return { results: await semanticSearch(query, user, limit), mode: "semantic" };
  } catch (e) {
    console.error("Semantic search failed, using keywords:", e.message);
    return { results: await keywordSearch(query, user, limit), mode: "keyword" };
  }
}