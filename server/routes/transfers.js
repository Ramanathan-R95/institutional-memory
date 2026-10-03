import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { cacheClear } from "../lib/gemini.js";
const router = Router();
router.use(requireAuth, requireRole("admin", "faculty"));

async function namesFor(ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const { data } = await supabase.from("profiles").select("id, name").in("id", clean);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.name]));
}

// ---------- List ----------
router.get("/", async (req, res) => {
  let q = supabase
    .from("transfers")
    .select("*, assets(type, location)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (req.query.status) q = q.eq("status", req.query.status);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });

  const names = await namesFor(data.flatMap((t) => [t.requested_by, t.approved_by]));
  res.json(data.map((t) => ({
    ...t,
    requested_by_name: names[t.requested_by] ?? null,
    approved_by_name: names[t.approved_by] ?? null,
  })));
});

// ---------- Request a transfer ----------
router.post("/", async (req, res) => {
  const { asset_id, to_location, to_user } = req.body;
  if (!asset_id || !to_location?.trim())
    return res.status(400).json({ error: "asset_id and to_location are required" });

  const { data: asset } = await supabase.from("assets").select("id, location").eq("id", asset_id).maybeSingle();
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  if (asset.location === to_location.trim())
    return res.status(400).json({ error: "Asset is already at that location" });

  const { data: open } = await supabase
    .from("transfers").select("id").eq("asset_id", asset_id).eq("status", "pending").limit(1);
  if (open?.length) return res.status(409).json({ error: "A transfer is already pending for this asset" });

  const { data, error } = await supabase
    .from("transfers")
    .insert({ asset_id, to_location: to_location.trim(), to_user: to_user || null, requested_by: req.user.id })
    .select().single();
  if (error) {
    const dup = error.code === "23505";
    return res.status(dup ? 409 : 400).json({ error: dup ? "A transfer is already pending for this asset" : error.message });
}
  res.status(201).json(data);
});

// ---------- Approve ----------
router.post("/:id/approve", async (req, res) => {
  const { data: t } = await supabase.from("transfers").select("*").eq("id", req.params.id).maybeSingle();
  if (!t) return res.status(404).json({ error: "Transfer not found" });
  if (t.status !== "pending") return res.status(409).json({ error: `Already ${t.status}` });
  if (t.requested_by === req.user.id) return res.status(403).json({ error: "You can't approve your own request" });

  const { data: claimed } = await supabase
    .from("transfers").update({ status: "approved", approved_by: req.user.id })
    .eq("id", t.id).eq("status", "pending").select().maybeSingle();
  if (!claimed) return res.status(409).json({ error: "Already decided" });

  const undoClaim = () =>
    supabase.from("transfers").update({ status: "pending", approved_by: null }).eq("id", t.id);

  const { data: asset } = await supabase.from("assets").select("*").eq("id", t.asset_id).single();
  const newCustodian = t.to_user ?? asset.custodian_id;

  const { error } = await supabase.from("assets")
    .update({ location: t.to_location, custodian_id: newCustodian, status: "active" }).eq("id", asset.id);
  if (error) { await undoClaim(); return res.status(400).json({ error: error.message }); }

  const { error: evErr } = await supabase.from("asset_events").insert({
    asset_id: asset.id, event_type: "transferred",
    from_location: asset.location, to_location: t.to_location,
    from_user: asset.custodian_id, to_user: newCustodian,
    approved_by: req.user.id, notes: `Transfer request #${t.id}`,
  });
  if (evErr) {
    await supabase.from("assets")
      .update({ location: asset.location, custodian_id: asset.custodian_id, status: asset.status }).eq("id", asset.id);
    await undoClaim();
    return res.status(500).json({ error: "Could not record the history, so nothing was changed. Please retry." });
  }

  cacheClear(); // AI answers must reflect the move immediately
  res.json({ ok: true });
});

// ---------- Reject ----------
router.post("/:id/reject", async (req, res) => {
  const { data, error } = await supabase
    .from("transfers")
    .update({ status: "rejected", approved_by: req.user.id })
    .eq("id", req.params.id).eq("status", "pending")
    .select().maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(409).json({ error: "Transfer not found or already decided" });
  res.json({ ok: true });
});

export default router;