import { supabase } from "./supabase.js";
import { semanticSearch } from "./embed.js";
const SELECT = "*, departments(name), custodian:profiles!custodian_id(name)";
const isStaff = (u) => ["admin", "faculty"].includes(u.role);
import { smartSearch } from "./embed.js";
import { likeSafe } from "./safe.js";
// Students only get basic, non-sensitive fields
function shape(a, user) {
  const base = {
    id: a.id, type: a.type, department: a.departments?.name,
    location: a.location, status: a.status,
  };
  if (!isStaff(user)) return base;
  return {
    ...base,
    custodian: a.custodian?.name ?? null,
    serial_no: a.serial_no, vendor: a.vendor, cost: a.cost,
    purchase_date: a.purchase_date, warranty_expiry: a.warranty_expiry,
    last_maintenance: a.last_maintenance, next_maintenance: a.next_maintenance,
  };
}

async function resolveAsset(idText) {
  const { data: exact } = await supabase.from("assets").select(SELECT).eq("id", idText).maybeSingle();
  if (exact) return { asset: exact };
  // Partial match, so "P-102" finds CSE-PROJ-P-102
  const { data } = await supabase.from("assets").select(SELECT).ilike("id", `%${idText}%`).limit(5);
  if (!data?.length) return { error: `No asset matches "${idText}"` };
  if (data.length > 1) return { error: `Ambiguous. Matches: ${data.map((a) => a.id).join(", ")}` };
  return { asset: data[0] };
}

export const toolDefs = [
  {
    name: "get_asset",
    description: "Get full details of ONE asset: location, custodian, status, maintenance, warranty. Accepts a full or partial asset ID (e.g. 'P-102' or 'CSE-LAB-PC-042').",
    input_schema: { type: "object", properties: { asset_id: { type: "string" } }, required: ["asset_id"] },
  },
  {
    name: "search_assets",
    description: "Find assets by filters. Use for questions like 'which computers are unused', 'projectors in CSE', 'maintenance overdue', 'warranty expiring soon'.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text matched against asset ID, type and location, e.g. 'projector' or 'Lab 2'" },
        department: { type: "string", description: "CSE, ECE, MECH or ADMIN" },
        status: { type: "string", enum: ["active", "unused", "under_repair"] },
        unassigned: { type: "boolean", description: "Only assets with no custodian" },
        maintenance_overdue: { type: "boolean" },
        warranty_expiring_within_days: { type: "integer" },
      },
    },
  },
  {
    name: "get_asset_history",
    description: "Get the full lifecycle timeline of one asset: purchases, assignments, transfers (who approved, from/to where), maintenance. Use for 'who had it before', 'who approved the transfer', 'when was it maintained'.",
    input_schema: { type: "object", properties: { asset_id: { type: "string" } }, required: ["asset_id"] },
  },
  {
    name: "get_pending_transfers",
    description: "List transfer requests still waiting for approval.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_knowledge",
    description: "Search institutional knowledge: past student projects, department decisions, lab procedures, meeting records. Use for 'previous projects on X', 'why was Y replaced', 'how do we calibrate Z'.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
];

export const handlers = {
  async get_asset({ asset_id }, user) {
    const r = await resolveAsset(asset_id);
    if (r.error) return r;
    const { data: pending } = await supabase
      .from("transfers").select("to_location").eq("asset_id", r.asset.id).eq("status", "pending").maybeSingle();
    return { ...shape(r.asset, user), pending_transfer_to: pending?.to_location ?? null };
  },

  async search_assets(args, user) {
    let q = supabase.from("assets").select(SELECT).order("id").limit(25);
    const today = new Date().toISOString().slice(0, 10);

    const term = likeSafe(args.query);
    if (term) q = q.or(`id.ilike.%${term}%,type.ilike.%${term}%,location.ilike.%${term}%`);
    if (args.status) q = q.eq("status", args.status);
    if (args.unassigned) q = q.is("custodian_id", null);
    if (args.maintenance_overdue) q = q.lt("next_maintenance", today);
    if (args.warranty_expiring_within_days) {
      const end = new Date(Date.now() + args.warranty_expiring_within_days * 86400000).toISOString().slice(0, 10);
      q = q.gte("warranty_expiry", today).lte("warranty_expiry", end);
    }
    if (args.department) {
      const { data: d } = await supabase.from("departments").select("id").ilike("name", args.department).maybeSingle();
      if (!d) return { error: `Unknown department ${args.department}` };
      q = q.eq("department_id", d.id);
    }

    const { data, error } = await q;
    if (error) return { error: error.message };
    return { count: data.length, assets: data.map((a) => shape(a, user)) };
  },

  async get_asset_history({ asset_id }, user) {
    if (!isStaff(user)) return { error: "Asset history is restricted to faculty and admin." };
    const r = await resolveAsset(asset_id);
    if (r.error) return r;

    const { data: events } = await supabase
      .from("asset_events").select("*").eq("asset_id", r.asset.id).order("created_at", { ascending: false });

    const ids = [...new Set((events ?? []).flatMap((e) => [e.from_user, e.to_user, e.approved_by]).filter(Boolean))];
    const { data: people } = ids.length ? await supabase.from("profiles").select("id, name").in("id", ids) : { data: [] };
    const nameOf = Object.fromEntries((people ?? []).map((p) => [p.id, p.name]));

    return {
      asset_id: r.asset.id,
      events: (events ?? []).map((e) => ({
        date: e.created_at.slice(0, 10), type: e.event_type,
        from_location: e.from_location, to_location: e.to_location,
        from_user: nameOf[e.from_user] ?? null, to_user: nameOf[e.to_user] ?? null,
        approved_by: nameOf[e.approved_by] ?? null, notes: e.notes,
      })),
    };
  },

  async get_pending_transfers(_args, user) {
    if (!isStaff(user)) return { error: "Restricted to faculty and admin." };
    const { data } = await supabase
      .from("transfers").select("id, asset_id, to_location, requested_by, created_at").eq("status", "pending");
    const ids = (data ?? []).map((t) => t.requested_by).filter(Boolean);
    const { data: people } = ids.length ? await supabase.from("profiles").select("id, name").in("id", ids) : { data: [] };
    const nameOf = Object.fromEntries((people ?? []).map((p) => [p.id, p.name]));
    return (data ?? []).map((t) => ({ ...t, requested_by: nameOf[t.requested_by] ?? null }));
  },

  // Keyword search for now. In Phase 7 we swap this for vector search.
     async search_knowledge({ query }, user) {
    try {
      const { results } = await smartSearch(String(query).slice(0, 200), user, 5);
      return { results: results.map(({ similarity, ...r }) =>
        similarity != null ? { ...r, relevance: Number(similarity.toFixed(2)) } : r) };
    } catch (e) {
      return { error: e.message };
    }
  },
};