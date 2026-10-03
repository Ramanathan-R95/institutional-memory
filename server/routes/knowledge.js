import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { embedText, itemText, smartSearch } from "../lib/embed.js";
const router = Router();
router.use(requireAuth);

const isStaff = (u) => ["admin", "faculty"].includes(u.role);

// ---------- Browse (no query) ----------
router.get("/", async (req, res) => {
  let q = supabase
    .from("knowledge_items")
    .select("id, kind, title, content, year, faculty_guide, departments(name)")
    .order("year", { ascending: false })
    .limit(50);
  if (req.query.kind) q = q.eq("kind", req.query.kind);
  if (!isStaff(req.user)) q = q.in("kind", ["project", "procedure"]);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------- Semantic search ----------
router.get("/search", async (req, res) => {
  const query = (req.query.q || "").trim().slice(0, 200);
  if (!query) return res.status(400).json({ error: "q is required" });
  const { results } = await smartSearch(query, req.user);
  res.json(req.query.kind ? results.filter((r) => r.kind === req.query.kind) : results);
});

// ---------- Add knowledge (admin / faculty), embedded on insert ----------
router.post("/", requireRole("admin", "faculty"), async (req, res) => {
  const { kind, title, content, year, faculty_guide, department_id } = req.body;
  if (!kind || !title?.trim() || !content?.trim())
    return res.status(400).json({ error: "kind, title and content are required" });

  let embedding = null;
  try {
    embedding = await embedText(itemText({ kind, title, content }), "RETRIEVAL_DOCUMENT");
  } catch (e) {
    console.error("Embedding failed (saving without it):", e.message);
  }

  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({
      kind, title: title.trim(), content: content.trim(),
      year: year || null, faculty_guide: faculty_guide || null,
      department_id: department_id || null, embedding,
    })
    .select("id, kind, title").single();
  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({ ...data, embedded: !!embedding });
});

export default router;