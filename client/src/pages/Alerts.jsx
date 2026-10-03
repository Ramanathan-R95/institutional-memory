import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, ShieldAlert, UserX, ArrowRightLeft, FileWarning } from "lucide-react";
import { api } from "../lib/api";

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

function Section({ icon: Icon, title, color, items, children }) {
  return (
    <section className="card">
      <div className="flex items-center gap-2 p-4 border-b">
        <Icon size={18} className={color} />
        <h2 className="font-semibold">{title}</h2>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-100 ${items.length ? "font-bold" : ""}`}>{items.length}</span>
      </div>
      {items.length === 0
        ? <p className="p-4 text-sm text-slate-400">All clear.</p>
        : <ul className="divide-y">{children}</ul>}
    </section>
  );
}

const AssetLink = ({ a }) => (
  <Link to={`/asset/${a.id}`} className="font-mono text-indigo-600 hover:underline">{a.id}</Link>
);

export default function Alerts() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api("/alerts").then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!d) return <p className="text-slate-500">Loading alerts...</p>;

  const row = "px-4 py-2.5 text-sm flex flex-wrap gap-x-3 items-baseline";

  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className="text-2xl font-bold">Smart Alerts</h1>

      <Section icon={Wrench} color="text-red-600" title="Maintenance overdue" items={d.maintenance_overdue}>
        {d.maintenance_overdue.map((a) => (
          <li key={a.id} className={row}><AssetLink a={a} /><span>{a.type}</span>
            <span className="text-slate-500">{a.location}</span>
            <span className="ml-auto text-red-600 text-xs">Due {fmt(a.next_maintenance)}</span></li>
        ))}
      </Section>

      <Section icon={ShieldAlert} color="text-amber-600" title="Warranty expiring in 30 days" items={d.warranty_expiring}>
        {d.warranty_expiring.map((a) => (
          <li key={a.id} className={row}><AssetLink a={a} /><span>{a.type}</span>
            <span className="text-slate-500">{a.location}</span>
            <span className="ml-auto text-amber-600 text-xs">Expires {fmt(a.warranty_expiry)}</span></li>
        ))}
      </Section>

      <Section icon={UserX} color="text-orange-600" title="Assets without a custodian" items={d.unassigned}>
        {d.unassigned.map((a) => (
          <li key={a.id} className={row}><AssetLink a={a} /><span>{a.type}</span>
            <span className="text-slate-500">{a.location}</span></li>
        ))}
      </Section>

      <Section icon={ArrowRightLeft} color="text-indigo-600" title="Transfers awaiting approval" items={d.pending_transfers}>
        {d.pending_transfers.map((t) => (
          <li key={t.id} className={row}>
            <Link to={`/asset/${t.asset_id}`} className="font-mono text-indigo-600 hover:underline">{t.asset_id}</Link>
            <span>→ {t.to_location}</span>
            <Link to="/transfers" className="ml-auto text-xs text-indigo-600 hover:underline">Review</Link>
          </li>
        ))}
      </Section>

      <Section icon={FileWarning} color="text-slate-600" title="Projects missing final documentation" items={d.projects_missing_docs}>
        {d.projects_missing_docs.map((p) => (
          <li key={p.id} className={row}><span className="font-medium">{p.title}</span>
            <span className="text-slate-500">{p.year}{p.faculty_guide && ` · ${p.faculty_guide}`}</span></li>
        ))}
      </Section>
    </div>
  );
}