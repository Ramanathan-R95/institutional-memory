import { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

const kinds = ["", "project", "decision", "procedure", "meeting"];
const kindColor = {
  project: "bg-indigo-100 text-indigo-700",
  decision: "bg-amber-100 text-amber-700",
  procedure: "bg-green-100 text-green-700",
  meeting: "bg-slate-200 text-slate-700",
};
const emptyForm = { kind: "project", title: "", content: "", year: new Date().getFullYear(), faculty_guide: "" };

export default function Knowledge() {
  const { user } = useAuth();
  const staff = ["admin", "faculty"].includes(user.role);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saveMsg, setSaveMsg] = useState("");

  async function load(query = q) {
    setLoading(true); setError("");
    try {
      const k = kind ? `kind=${kind}` : "";
      const path = query.trim()
        ? `/knowledge/search?q=${encodeURIComponent(query)}${k ? "&" + k : ""}`
        : `/knowledge${k ? "?" + k : ""}`;
      const d = await api(path);
      setItems(Array.isArray(d) ? d : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [kind]);

  async function save(e) {
    e.preventDefault();
    setError(""); setSaveMsg("");
    try {
      const r = await api("/knowledge", { method: "POST", body: form });
      setSaveMsg(r.embedded ? "Saved and indexed for search." : "Saved. Search indexing will happen on the next embed run.");
      setForm(emptyForm); setAdding(false); load();
    } catch (err) {
      setError(err.message);
    }
  }

  const input = "input text-sm";

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Institutional Knowledge</h1>
        {staff && (
          <button onClick={() => setAdding(!adding)} className="inline-flex items-center gap-1 text-sm bg-indigo-600 text-white rounded-lg px-3 py-2">
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input className="w-full border rounded-xl pl-9 pr-3 py-2.5 bg-white"
            placeholder='Try "IoT transportation" or "crop disease detection"'
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="bg-indigo-600 text-white rounded-xl px-5">Search</button>
      </form>

      <div className="flex gap-2 flex-wrap">
        {kinds.filter((k) => staff || ["", "project", "procedure"].includes(k)).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`px-3 py-1 rounded-full text-sm border capitalize ${kind === k ? "bg-indigo-600 text-white" : "bg-white"}`}>
            {k || "all"}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {saveMsg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{saveMsg}</p>}

      {adding && (
        <form onSubmit={save} className="card p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {kinds.filter(Boolean).map((k) => <option key={k}>{k}</option>)}
            </select>
            <input className={input} type="number" placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            <input className={input} placeholder="Faculty guide" value={form.faculty_guide} onChange={(e) => setForm({ ...form, faculty_guide: e.target.value })} />
          </div>
          <input required className={input} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea required rows={4} className={input} placeholder="Describe the project, decision, or procedure..."
            value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <button className="btn btn-primary text-sm">Save</button>
        </form>
      )}

      {loading && <p className="text-sm text-slate-400 animate-pulse">Searching...</p>}

      <div className="space-y-3">
        {items.map((k) => (
          <article key={k.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${kindColor[k.kind] ?? "bg-slate-100"}`}>{k.kind}</span>
              <h2 className="font-semibold">{k.title}</h2>
              {k.similarity != null && (
                <span className="ml-auto text-xs text-slate-400">{Math.round(k.similarity * 100)}% match</span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">{k.content}</p>
            <div className="text-xs text-slate-500 mt-2">
              {k.year}{k.faculty_guide && <> · Guide: {k.faculty_guide}</>}{k.departments?.name && <> · {k.departments.name}</>}
            </div>
          </article>
        ))}
        {!loading && items.length === 0 && <p className="text-center text-slate-500 py-6">No results. Try different words.</p>}
      </div>
    </div>
  );
}