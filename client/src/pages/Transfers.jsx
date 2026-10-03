import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../lib/toast";
const badge = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function Decision({ t, user, onDecide }) {
  if (t.status !== "pending") return null;
  if (t.requested_by === user.id) return <span className="text-xs text-slate-400">Awaiting another approver</span>;
  return (
    <div className="flex gap-2">
      <button onClick={() => onDecide(t.id, "approve")} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-500"><Check size={14} /> Approve</button>
      <button onClick={() => onDecide(t.id, "reject")} className="btn btn-sm btn-ghost text-red-600"><X size={14} /> Reject</button>
    </div>
  );
}

export default function Transfers() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("pending");
  const toast = useToast();
  const load = () =>
    api(`/transfers${filter ? `?status=${filter}` : ""}`)
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, [filter]);

  async function decide(id, action) {
    setError("");
    try {
      await api(`/transfers/${id}/${action}`, { method: "POST" });
      toast(action === "approve" ? "Transfer approved. Asset updated." : "Transfer rejected.");
      await load();
    } catch (e) { setError(e.message); toast(e.message, "error"); }
}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Transfers</h1>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {["pending", "approved", "rejected", ""].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`chip capitalize ${filter === s ? "chip-active" : ""}`}>{s || "all"}</button>
        ))}
      </div>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {/* Desktop table */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="p-3.5">Asset</th><th className="p-3.5">From → To</th><th className="p-3.5">Requested by</th><th className="p-3.5">Status</th><th className="p-3.5"></th></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="p-3.5 font-mono"><Link className="text-indigo-600 hover:underline" to={`/asset/${t.asset_id}`}>{t.asset_id}</Link></td>
                <td className="p-3.5">{t.assets?.location ?? "?"} → <b>{t.to_location}</b></td>
                <td className="p-3.5">{t.requested_by_name}</td>
                <td className="p-3.5">
                  <span className={`badge capitalize ${badge[t.status]}`}>{t.status}</span>
                  {t.approved_by_name && <span className="ml-2 text-xs text-slate-500">by {t.approved_by_name}</span>}
                </td>
                <td className="p-3.5 text-right"><Decision t={t} user={user} onDecide={decide} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((t) => (
          <div key={t.id} className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <Link className="truncate font-mono text-sm font-bold text-indigo-600" to={`/asset/${t.asset_id}`}>{t.asset_id}</Link>
              <span className={`badge capitalize ${badge[t.status]}`}>{t.status}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">{t.assets?.location ?? "?"}</span>
              <ArrowRight size={14} className="shrink-0 text-slate-400" />
              <b>{t.to_location}</b>
            </div>
            <div className="text-xs text-slate-500">
              Requested by {t.requested_by_name}{t.approved_by_name && ` · Decided by ${t.approved_by_name}`}
            </div>
            <Decision t={t} user={user} onDecide={decide} />
          </div>
        ))}
      </div>

      {rows.length === 0 && <p className="py-10 text-center text-slate-500">Nothing here.</p>}
    </div>
  );
}