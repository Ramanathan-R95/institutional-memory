import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Printer } from "lucide-react";
import { api } from "../lib/api";
import QRCard from "./QRCard";

export default function BulkReview({ doc, depts, onCancel }) {
  const x = doc.extracted;
  const [common, setCommon] = useState({
    department_id: "", location: "",
    vendor: x.vendor || "", purchase_date: x.purchase_date || "", warranty_months: x.warranty_months ?? "",
  });

  // One row per physical unit: "10 desktops" becomes 10 rows
  const [rows, setRows] = useState(() =>
    (x.items || []).flatMap((it) =>
      Array.from({ length: Math.max(1, Number(it.quantity) || 1) }, (_, i) => ({
        type: it.asset_type || "", serial_no: it.serial_numbers?.[i] || "", cost: it.unit_cost ?? "",
      }))
    )
  );
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setC = (k) => (e) => setCommon({ ...common, [k]: e.target.value });
  const setRow = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function submit() {
    setBusy(true); setError("");
    try {
      const out = await api("/assets/bulk", {
        method: "POST",
        body: { ...common, items: rows, document_path: doc.file_path, document_name: doc.file_name },
      });
      const dept = depts.find((d) => String(d.id) === String(common.department_id));
      setResult({
        ...out,
        created: out.created.map(({ asset, qr }) => ({ ...asset, qr, departments: dept ? { name: dept.name } : null })),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 print:hidden">
          <h1 className="text-2xl font-bold text-green-700">✓ {result.created.length} assets registered</h1>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 btn btn-primary text-sm">
            <Printer size={14} /> Print all labels
          </button>
          <Link to="/assets" className="text-sm text-indigo-600 hover:underline">View in registry</Link>
        </div>
        {result.failed.length > 0 && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 print:hidden">
            {result.failed.length} failed: {result.failed.map((f) => `${f.type} (${f.error})`).join("; ")}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {result.created.map((a) => <QRCard key={a.id} asset={a} />)}
        </div>
      </div>
    );
  }

  const input = "w-full border rounded-lg px-2 py-1.5 bg-white text-sm";
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Review {rows.length} assets from invoice</h1>
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
        ✓ AI found {rows.length} units in <b>{doc.file_name}</b>. Check the details, then register them all.
      </p>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div className="card p-4 grid sm:grid-cols-3 gap-3">
        <label className="text-xs text-slate-500">Department
          <select className={input} value={common.department_id} onChange={setC("department_id")}>
            <option value="">Select...</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Location (all units)
          <input className={input} placeholder="CSE Lab 2" value={common.location} onChange={setC("location")} />
        </label>
        <label className="text-xs text-slate-500">Vendor
          <input className={input} value={common.vendor} onChange={setC("vendor")} />
        </label>
        <label className="text-xs text-slate-500">Purchase date
          <input type="date" className={input} value={common.purchase_date} onChange={setC("purchase_date")} />
        </label>
        <label className="text-xs text-slate-500">Warranty (months)
          <input type="number" className={input} value={common.warranty_months} onChange={setC("warranty_months")} />
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr><th className="p-2">#</th><th className="p-2">Type</th><th className="p-2">Serial no.</th><th className="p-2">Unit cost (₹)</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 text-slate-400">{i + 1}</td>
                <td className="p-2"><input className={input} value={r.type} onChange={(e) => setRow(i, "type", e.target.value)} /></td>
                <td className="p-2"><input className={input} value={r.serial_no} onChange={(e) => setRow(i, "serial_no", e.target.value)} /></td>
                <td className="p-2"><input type="number" className={input} value={r.cost} onChange={(e) => setRow(i, "cost", e.target.value)} /></td>
                <td className="p-2"><button title="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-red-500"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button disabled={busy || !rows.length} onClick={submit}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-2 font-medium disabled:opacity-50">
          {busy ? "Registering..." : `Register all ${rows.length} & generate QR codes`}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-600 hover:underline">Cancel</button>
      </div>
    </div>
  );
}