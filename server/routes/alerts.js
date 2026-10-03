import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "faculty"));

router.get("/", async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const cols = "id, type, location, status, next_maintenance, warranty_expiry, departments(name)";

  const [overdue, warranty, unassigned, transfers, projects, docs] = await Promise.all([
    supabase.from("assets").select(cols).lt("next_maintenance", today).order("next_maintenance").limit(50),
    supabase.from("assets").select(cols).gte("warranty_expiry", today).lte("warranty_expiry", in30).order("warranty_expiry").limit(50),
    supabase.from("assets").select(cols).is("custodian_id", null).limit(50),
    supabase.from("transfers").select("id, asset_id, to_location, created_at").eq("status", "pending"),
    supabase.from("knowledge_items").select("id, title, year, faculty_guide").eq("kind", "project"),
    supabase.from("documents").select("knowledge_id").not("knowledge_id", "is", null),
  ]);

  const failed = [overdue, warranty, unassigned, transfers, projects, docs].find((r) => r.error);
  if (failed) return res.status(400).json({ error: failed.error.message });

  const documented = new Set(docs.data.map((d) => d.knowledge_id));
  const missingDocs = projects.data.filter((p) => !documented.has(p.id));

  res.json({
    maintenance_overdue: overdue.data,
    warranty_expiring: warranty.data,
    unassigned: unassigned.data,
    pending_transfers: transfers.data,
    projects_missing_docs: missingDocs,
  });
});

export default router;