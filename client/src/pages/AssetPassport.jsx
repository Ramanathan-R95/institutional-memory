import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, MapPin, User, ShieldCheck, Wrench, ChevronLeft } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import Timeline from "../components/Timeline";
import QRCard from "../components/QRCard";
import TransferForm from "../components/TransferForm";
import { statusColor } from "./AssetList";
import { useToast } from "../lib/toast";
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");
const inr = (n) => (n ? "₹" + Number(n).toLocaleString("en-IN") : "-");

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="break-all text-right font-medium">{children}</span>
    </div>
  );
}

function Tile({ icon: Icon, label, value, warn }) {
  return (
    <div className={`rounded-2xl p-3.5 ${warn ? "bg-red-50" : "bg-slate-50"}`}>
      <div className={`flex items-center gap-1.5 text-xs ${warn ? "text-red-500" : "text-slate-500"}`}><Icon size={13} /> {label}</div>
      <div className={`mt-1 text-sm font-semibold leading-snug ${warn ? "text-red-700" : ""}`}>{value}</div>
    </div>
  );
}

export default function AssetPassport() {
  const { id } = useParams();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");
  const toast = useToast()
  const load = () =>
    api(`/assets/${encodeURIComponent(id)}`).then(setAsset).catch((e) => setError(e.message));

  useEffect(() => { setAsset(null); setError(""); load(); }, [id]);

  if (error) return <div className="text-red-600">{error} · <Link className="underline" to="/assets">Back to list</Link></div>;
  if (!asset) return <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />;
  if (asset.restricted) {
      return (
        <div className="rise mx-auto max-w-md space-y-5">
          <Link to="/assets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
            <ChevronLeft size={16} /> Assets
          </Link>
          <section className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Asset</p>
            <h1 className="mt-1 break-all font-mono text-xl font-extrabold">{asset.id}</h1>
            <p className="text-slate-500">{asset.type} · {asset.departments?.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Tile icon={MapPin} label="Location" value={asset.location ?? "-"} />
              <Tile icon={ShieldCheck} label="Status" value={(asset.status ?? "-").replace("_", " ")} />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Purchase, custody and history details are visible to faculty and admin.
            </p>
          </section>
        </div>
      );
    }
  const overdue = asset.next_maintenance && new Date(asset.next_maintenance) < new Date();
  const canTransfer = ["admin", "faculty"].includes(user.role) && !asset.pending_transfer;

  return (
    <div className="rise space-y-5">
      <Link to="/assets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 print:hidden">
        <ChevronLeft size={16} /> Assets
      </Link>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {/* Header + details */}
        <div className="space-y-5 lg:col-span-2 lg:col-start-1 lg:row-start-1 print:hidden">
          <section className="card p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Digital Asset Passport</p>
            <h1 className="mt-1 break-all font-mono text-xl font-extrabold sm:text-2xl">{asset.id}</h1>
            <p className="text-slate-500">{asset.type} · {asset.departments?.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`badge capitalize ${statusColor[asset.status] ?? "bg-slate-100"}`}>{asset.status?.replace("_", " ")}</span>
              {overdue && <span className="badge bg-red-100 text-red-700">Maintenance overdue</span>}
              {asset.pending_transfer && <span className="badge bg-indigo-100 text-indigo-700">Transfer pending → {asset.pending_transfer.to_location}</span>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Tile icon={MapPin} label="Location" value={asset.location ?? "-"} />
              <Tile icon={User} label="Custodian" value={asset.custodian?.name ?? "Unassigned"} />
              <Tile icon={Wrench} label="Next maintenance" value={fmt(asset.next_maintenance)} warn={overdue} />
              <Tile icon={ShieldCheck} label="Warranty until" value={fmt(asset.warranty_expiry)} />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-1 font-semibold">Details</h2>
            <Row label="Serial no.">{asset.serial_no ?? "-"}</Row>
            <Row label="Vendor">{asset.vendor ?? "-"}</Row>
            <Row label="Cost">{inr(asset.cost)}</Row>
            <Row label="Purchased">{fmt(asset.purchase_date)}</Row>
            <Row label="Last maintenance">{fmt(asset.last_maintenance)}</Row>
          </section>
        </div>

        {/* QR, transfer, documents */}
        <div className="space-y-5 lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <QRCard asset={asset} />
          {canTransfer && <TransferForm asset={asset} onDone={load} />}
          <section className="card p-5 print:hidden">
            <h2 className="mb-2 font-semibold">Documents</h2>
            {asset.documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded yet.</p>
            ) : (
              asset.documents.map((d) => (
                <button key={d.id}
                  onClick={async () => {
                    try { window.open((await api(`/documents/${d.id}/url`)).url, "_blank"); }
                    catch (e) { toast(e.message, "error"); }
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50">
                  <FileText size={15} className="shrink-0" /> <span className="truncate">{d.title}</span>
                </button>
              ))
            )}
          </section>
        </div>

        {/* Timeline */}
        <section className="card p-5 lg:col-span-2 lg:col-start-1 lg:row-start-2 print:hidden">
          <h2 className="mb-4 font-semibold">Lifecycle Timeline</h2>
          <Timeline events={asset.events} />
        </section>
      </div>
    </div>
  );
}