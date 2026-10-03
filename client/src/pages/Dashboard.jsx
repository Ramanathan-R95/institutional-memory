import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes, CheckCircle2, PackageOpen, Wrench, ScanLine, Sparkles, PlusCircle,
  ShieldAlert, UserX, ArrowRightLeft, FileWarning,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import StatCard from "../components/StatCard";

export default function Dashboard() {
  const { user } = useAuth();
  const staff = ["admin", "faculty"].includes(user.role);
  // const [assets, setAssets] = useState([]);
  // const [alerts, setAlerts] = useState(null);
  // const [error, setError] = useState("");
  const [stats, setStats] = useState({ total: 0, active: 0, unused: 0, under_repair: 0 });
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/assets/stats").then(setStats).catch((e) => setError(e.message));
    if (staff) api("/alerts").then(setAlerts).catch(() => {});
  }, []);
  // useEffect(() => {
  //   api("/assets").then((d) => setAssets(Array.isArray(d) ? d : [])).catch((e) => setError(e.message));
  //   if (staff) api("/alerts").then(setAlerts).catch(() => {});
  // }, []);

  // const count = (s) => assets.filter((a) => a.status === s).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.replace(/\(.*?\)/g, "").trim();

  const alertCards = alerts && [
    { label: "Maintenance overdue", value: alerts.maintenance_overdue.length, tone: "red", icon: Wrench, to: "/alerts" },
    { label: "Warranty expiring", value: alerts.warranty_expiring.length, tone: "amber", icon: ShieldAlert, to: "/alerts" },
    { label: "No custodian", value: alerts.unassigned.length, tone: "orange", icon: UserX, to: "/alerts" },
    { label: "Pending transfers", value: alerts.pending_transfers.length, tone: "indigo", icon: ArrowRightLeft, to: "/transfers" },
    { label: "Projects w/o docs", value: alerts.projects_missing_docs.length, tone: "slate", icon: FileWarning, to: "/alerts" },
  ];

  return (
    <div className="space-y-6">
      <section className="rise relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-indigo-600/20 sm:p-8">
        <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm text-indigo-100">{greeting},</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{firstName}</h1>
        <p className="mt-2 max-w-md text-sm text-indigo-100">
          Scan an asset, ask the institution a question, or review what needs attention today.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/scan" className="btn bg-white text-indigo-700 hover:bg-indigo-50"><ScanLine size={16} /> Scan QR</Link>
          <Link to="/ask" className="btn bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25"><Sparkles size={16} /> Ask AI</Link>
          {user.role === "admin" && (
            <Link to="/assets/new" className="btn bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25"><PlusCircle size={16} /> Register</Link>
          )}
        </div>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Asset overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Total assets" value={stats.total} icon={Boxes} tone="indigo" />
          <StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="green" />
          <StatCard label="Unused" value={stats.unused} icon={PackageOpen} tone="amber" />
          <StatCard label="Under repair" value={stats.under_repair} icon={Wrench} tone="red" />
        </div>
      </section>

      {alertCards && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Needs attention</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {alertCards.map((c) => (
              <Link key={c.label} to={c.to} className="block"><StatCard {...c} /></Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}