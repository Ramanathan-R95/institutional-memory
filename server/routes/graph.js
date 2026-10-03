import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/knowledge/:id", async (req, res) => {
  const id = String(req.params.id);
  const staff = ["admin", "faculty"].includes(req.user.role);
  const visible = (kind) => staff || ["project", "procedure"].includes(kind);

  const { data: center } = await supabase
    .from("knowledge_items").select("id, kind, title").eq("id", id).maybeSingle();
  if (!center) return res.status(404).json({ error: "Not found" });
  if (!visible(center.kind)) return res.status(403).json({ error: "Restricted to faculty and admin." });

  const nodes = new Map();
  const links = [];
  const addNode = (n) => { if (!nodes.has(n.id)) nodes.set(n.id, n); };
  const itemNode = (k, isCenter = false) => ({
    id: `item:${k.id}`, label: k.title, group: k.kind, ref_id: k.id, center: isCenter,
  });

  addNode(itemNode(center, true));

  // First hop: what this item is directly linked to
  const { data: direct } = await supabase
    .from("entity_links").select("*").eq("from_id", id);

  const entities = [];
  for (const l of direct ?? []) {
    const eid = `${l.to_type}:${l.to_id}`;
    addNode({ id: eid, label: l.to_id, group: l.to_type, ref_id: l.to_id });
    links.push({ source: `item:${id}`, target: eid, label: l.relation });
    if (l.to_type !== "department") entities.push(l); // departments link to everything, so skip them
  }

  // Second hop: other items sharing a student, guide or hardware
  const shared = await Promise.all(
    entities.map((l) =>
      supabase.from("entity_links").select("*")
        .eq("to_type", l.to_type).eq("to_id", l.to_id).neq("from_id", id).limit(5)
        .then((r) => r.data ?? [])
    )
  );
  const related = shared.flat().slice(0, 15);
  const relatedIds = [...new Set(related.map((l) => Number(l.from_id)))].slice(0, 8);

  if (relatedIds.length) {
    const { data: items } = await supabase
      .from("knowledge_items").select("id, kind, title").in("id", relatedIds);
    const ok = new Map((items ?? []).filter((k) => visible(k.kind)).map((k) => [String(k.id), k]));
    for (const l of related) {
      const k = ok.get(String(l.from_id));
      if (!k) continue;
      addNode(itemNode(k));
      links.push({ source: `item:${k.id}`, target: `${l.to_type}:${l.to_id}`, label: l.relation });
    }
  }

  res.json({ nodes: [...nodes.values()], links });
});

export default router;