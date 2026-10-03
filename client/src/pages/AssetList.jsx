import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, PlusCircle, ChevronRight, MapPin, User } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export const statusColor = {
  active: "bg-emerald-100 text-emerald-700",
  unused: "bg-amber-100 text-amber-700",
  under_repair: "bg-red-100 text-red-700",
};
const label = (s) => (s ?? "").replace("_", " ");
const filters = [["", "All"], ["active", "Active"], ["unused", "Unused"], ["under_repair", "Under repair"]];

export default function AssetList() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const PAGE = 50;
  const [more, setMore] = useState(false);
  const fetchPage = (offset) => api(`/assets?q=${encodeURIComponent(q)}${status ? `&status=${status}` : ""}&limit=${PAGE}&offset=${offset}`);
  useEffect(() => {
      let stale = false;
      setLoading(true);
      const t = setTimeout(() => {
        fetchPage(0)
          .then((d) => {
            if (stale) return;
            const rows = Array.isArray(d) ? d : [];
            setAssets(rows); setMore(rows.length === PAGE); setError("");
          })
          .catch((e) => { if (!stale) setError(e.message); })
          .finally(() => { if (!stale) setLoading(false); });
      }, 250);
      return () => { stale = true; clearTimeout(t); };
    }, [q, status]);

    async function loadMore() {
      try {
        const d = await fetchPage(assets.length);
        setAssets((a) => [...a, ...d]); setMore(d.length === PAGE);
      } catch (e) { setError(e.message); }
    }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Asset Registry</h1>
          <p className="text-sm text-slate-500">{loading ? "Loading..." : `${assets.length}${more ? "+" : ""} assets`}</p>
        </div>
        {user.role === "admin" && (
          <Link to="/assets/new" className="btn btn-primary"><PlusCircle size={16} /> <span className="hidden sm:inline">Register</span></Link>
        )}
      </div>

      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-3 text-slate-400" />
        <input className="input pl-10" placeholder="Search by ID, type or location..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {filters.map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`chip ${status === v ? "chip-active" : ""}`}>{l}</button>
        ))}
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading && assets.length === 0 && (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
      )}

      {/* Desktop table */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3.5">Asset ID</th><th className="p-3.5">Type</th><th className="p-3.5">Dept</th>
              <th className="p-3.5">Location</th><th className="p-3.5">Custodian</th><th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 transition hover:bg-indigo-50/40">
                <td className="p-3.5 font-mono font-medium"><Link className="text-indigo-600 hover:underline" to={`/asset/${a.id}`}>{a.id}</Link></td>
                <td className="p-3.5">{a.type}</td>
                <td className="p-3.5">{a.departments?.name}</td>
                <td className="p-3.5">{a.location}</td>
                <td className="p-3.5">{a.restricted ? "—" :a.custodian?.name ??  <span className="text-slate-400">None</span>}</td>
                <td className="p-3.5"><span className={`badge capitalize ${statusColor[a.status] ?? "bg-slate-100"}`}>{label(a.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {assets.map((a) => (
          <Link key={a.id} to={`/asset/${a.id}`} className="card flex items-center gap-3 p-4 active:bg-indigo-50">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-sm font-bold text-indigo-600">{a.id}</span>
                <span className={`badge shrink-0 capitalize ${statusColor[a.status] ?? "bg-slate-100"}`}>{label(a.status)}</span>
              </div>
              <div className="mt-0.5 text-sm font-medium">{a.type} <span className="font-normal text-slate-400">· {a.departments?.name}</span></div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><MapPin size={12} /> {a.location ?? "-"}</span>
                <span className="inline-flex items-center gap-1"><User size={12} /> {a.custodian?.name ?? "Unassigned"}</span>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
      {more && <button onClick={loadMore} className="btn btn-ghost w-full">Load more</button>}

      {!loading && assets.length === 0 && !error && <p className="py-10 text-center text-slate-500">No assets found.</p>}
    </div>
  );
}