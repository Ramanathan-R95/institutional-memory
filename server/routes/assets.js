import { Router } from "express";
import QRCode from "qrcode";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { likeSafe } from "../lib/safe.js";
import { cacheClear } from "../lib/gemini.js";
const router = Router();
router.use(requireAuth);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// QR encodes a URL, so any phone camera opens the passport page directly
const makeQR = (id) =>
  QRCode.toDataURL(`${CLIENT_URL}/asset/${encodeURIComponent(id)}`, { width: 400, margin: 2 });

const clean = (v) => (v === "" || v === undefined ? null : v);

const isStaff = (u) => ["admin", "faculty"].includes(u.role);
// Students get only the basics; cost, serials, custody and history stay private
const publicView = (a) => ({
  id: a.id, type: a.type, location: a.location, status: a.status,
  department_id: a.department_id, departments: a.departments, restricted: true,
});

const typeCode = (t) => t.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "AST";

// Works out IDs for many units with ONE lookup per prefix
async function allocateIds(deptName, types) {
  const counters = {};
  const ids = [];
  for (const t of types) {
    const prefix = `${deptName}-${typeCode(t)}`;
    if (counters[prefix] === undefined) {
      const { data } = await supabase.from("assets").select("id").like("id", `${prefix}-%`);
      counters[prefix] = (data ?? []).reduce((m, a) => Math.max(m, parseInt(a.id.split("-").pop()) || 0), 0);
    }
    counters[prefix] += 1;
    ids.push(`${prefix}-${String(counters[prefix]).padStart(3, "0")}`);
  }
  return ids;
}

// ---------- Register asset (admin) + auto QR ----------
router.post("/", requireRole("admin"), async (req, res) => {
  const b = req.body;
  if (!b.type) return res.status(400).json({ error: "type is required" });

  let deptName = "GEN";
  if (b.department_id) {
    const { data: d } = await supabase.from("departments").select("name").eq("id", b.department_id).single();
    if (d) deptName = d.name;
  }

  const id = b.id || (await allocateIds(deptName, [b.type]))[0];

  // AI extraction returns warranty_months, so convert it to an expiry date
  let warranty_expiry = clean(b.warranty_expiry);
  if (!warranty_expiry && b.warranty_months && b.purchase_date) {
    const d = new Date(b.purchase_date);
    d.setMonth(d.getMonth() + Number(b.warranty_months));
    warranty_expiry = d.toISOString().slice(0, 10);
  }

  const row = {
    id,
    type: b.type,
    serial_no: clean(b.serial_no),
    vendor: clean(b.vendor),
    cost: clean(b.cost),
    purchase_date: clean(b.purchase_date),
    warranty_expiry,
    department_id: clean(b.department_id),
    location: clean(b.location),
    custodian_id: clean(b.custodian_id),
    status: "active",
    next_maintenance: clean(b.next_maintenance),
  };

  const { data: asset, error } = await supabase.from("assets").insert(row).select().single();
  if (error) return res.status(error.code === "23505" ? 409 : 400).json({
      error: error.code === "23505" ? "That ID was just taken. Please submit again." : error.message });
  cacheClear();

  const events = [{ asset_id: id, event_type: "purchased", notes: `Registered by ${req.user.name}` }];
  if (row.location) {
    events.push({
      asset_id: id, event_type: "assigned", to_location: row.location,
      to_user: row.custodian_id, approved_by: req.user.id,
    });
  }
  await supabase.from("asset_events").insert(events);
  if (b.document_path) {
  await supabase.from("documents").insert({
    title: b.document_name || "Purchase invoice",
    doc_type: "invoice",
    file_url: b.document_path,
    asset_id: id,
    uploaded_by: req.user.id,
    extracted_json: b.extracted_json ?? null,
  });
  }
  res.status(201).json({ asset, qr: await makeQR(id) });
});
// ---------- Bulk register (admin): many units from one invoice ----------
router.post("/bulk", requireRole("admin"), async (req, res) => {
  const { items = [], ...c } = req.body;
  if (!items.length) return res.status(400).json({ error: "No items to register" });
  if (items.length > 100) return res.status(400).json({ error: "Maximum 100 items at a time" });

  let deptName = "GEN";
  if (c.department_id) {
    const { data: d } = await supabase.from("departments").select("name").eq("id", c.department_id).single();
    if (d) deptName = d.name;
  }

  let warranty_expiry = null;
  if (c.warranty_months && c.purchase_date) {
    const d = new Date(c.purchase_date);
    d.setMonth(d.getMonth() + Number(c.warranty_months));
    warranty_expiry = d.toISOString().slice(0, 10);
  }

  // One batch insert; retry if a concurrent registration took one of our IDs
  let assets = null;
  for (let attempt = 0; attempt < 3 && !assets; attempt++) {
    const ids = await allocateIds(deptName, items.map((it) => it.type || "Asset"));
    const rows = items.map((it, i) => ({
      id: ids[i], type: it.type || "Asset", serial_no: clean(it.serial_no), vendor: clean(c.vendor),
      cost: clean(it.cost), purchase_date: clean(c.purchase_date), warranty_expiry,
      department_id: clean(c.department_id), location: clean(c.location), status: "active",
    }));
    const { data, error } = await supabase.from("assets").insert(rows).select();
    if (!error) assets = data;
    else if (error.code !== "23505") return res.status(400).json({ error: error.message });
  }
  if (!assets) return res.status(409).json({ error: "Could not allocate unique IDs. Please retry." });

  await supabase.from("asset_events").insert(assets.flatMap((a) => [
    { asset_id: a.id, event_type: "purchased", notes: `Registered by ${req.user.name} (bulk)` },
    ...(a.location ? [{ asset_id: a.id, event_type: "assigned", to_location: a.location, approved_by: req.user.id }] : []),
  ]));

  if (c.document_path) {
    await supabase.from("documents").insert(assets.map((a) => ({
      title: c.document_name || "Purchase invoice", doc_type: "invoice",
      file_url: c.document_path, asset_id: a.id, uploaded_by: req.user.id,
    })));
  }

  cacheClear();
  const created = await Promise.all(assets.map(async (asset) => ({ asset, qr: await makeQR(asset.id) })));
  res.status(201).json({ created, failed: [] });
});// ---------- List / search ----------
router.get("/", async (req, res) => {
  const { q, department_id, status, location } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let query = supabase
    .from("assets")
    .select("*, departments(name), custodian:profiles!custodian_id(name)")
    .order("id")
    .range(offset, offset + limit - 1);

  const term = likeSafe(q);
  if (term) query = query.or(`id.ilike.%${term}%,type.ilike.%${term}%,location.ilike.%${term}%`);
  if (department_id) query = query.eq("department_id", department_id);
  if (status) query = query.eq("status", status);
  if (location) query = query.ilike("location", `%${likeSafe(location)}%`);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(isStaff(req.user) ? data : data.map(publicView));
});
router.get("/stats", async (_req, res) => {
  const count = (status) => {
    let q = supabase.from("assets").select("id", { count: "exact", head: true });
    return status ? q.eq("status", status) : q;
  };
  const [t, a, u, r] = await Promise.all([count(), count("active"), count("unused"), count("under_repair")]);
  res.json({ total: t.count ?? 0, active: a.count ?? 0, unused: u.count ?? 0, under_repair: r.count ?? 0 });
});

// ---------- Digital Asset Passport ----------
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data: asset, error } = await supabase
    .from("assets")
    .select("*, departments(name), custodian:profiles!custodian_id(name)")
    .eq("id", id)
    .single();
  if (error || !asset) return res.status(404).json({ error: "Asset not found" });
  if (!isStaff(req.user)) {
    return res.json({ ...publicView(asset), events: [], documents: [], pending_transfer: null, qr: await makeQR(id) });
  }
  const [{ data: rawEvents }, { data: documents }, { data: pending }] = await Promise.all([
    supabase.from("asset_events").select("*").eq("asset_id", id).order("created_at", { ascending: false }),
    supabase.from("documents").select("id, title, doc_type, file_url, created_at").eq("asset_id", id),
    supabase.from("transfers").select("*").eq("asset_id", id).eq("status", "pending").maybeSingle(),
  ]);

  // Replace user UUIDs with names so the timeline can show "approved by Dr. Priya"
  const ids = [...new Set((rawEvents ?? []).flatMap((e) => [e.from_user, e.to_user, e.approved_by]).filter(Boolean))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, name").in("id", ids)
    : { data: [] };
  const nameOf = Object.fromEntries((people ?? []).map((p) => [p.id, p.name]));

  const events = (rawEvents ?? []).map((e) => ({
    ...e,
    from_user_name: nameOf[e.from_user] ?? null,
    to_user_name: nameOf[e.to_user] ?? null,
    approved_by_name: nameOf[e.approved_by] ?? null,
  }));

  res.json({ ...asset, events, documents: documents ?? [], pending_transfer: pending, qr: await makeQR(id) });
});

// ---------- QR only (for printing labels) ----------
router.get("/:id/qr", async (req, res) => {
  res.json({ id: req.params.id, qr: await makeQR(req.params.id) });
});

// ---------- Log maintenance (admin) ----------
router.post("/:id/maintenance", requireRole("admin"), async (req, res) => {
  const today = new Date();
  const next = new Date(today.getTime() + 180 * 86400000);
  const last_maintenance = today.toISOString().slice(0, 10);
  const next_maintenance = req.body.next_maintenance || next.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("assets")
    .update({ last_maintenance, next_maintenance })
    .eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  await supabase.from("asset_events").insert({
    asset_id: req.params.id, event_type: "maintained",
    approved_by: req.user.id, notes: req.body.notes || "Routine maintenance",
  });
  cacheClear();
  res.json({ ok: true, last_maintenance, next_maintenance });
});

export default router;