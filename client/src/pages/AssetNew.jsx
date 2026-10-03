import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import QRCard from "../components/QRCard";
import UploadExtract from "../components/UploadExtract";
import BulkReview from "../components/BulkReview";

const empty = {
  type: "", department_id: "", location: "", serial_no: "", vendor: "",
  cost: "", purchase_date: "", warranty_months: "", next_maintenance: "",
};
const TYPES = ["Desktop Computer", "Laptop", "Projector", "Printer", "Network Switch", "Server",
  "Digital Oscilloscope", "3D Printer", "Raspberry Pi Kit", "College Bus"];

const unitCount = (x) =>
  (x?.items ?? []).reduce((n, i) => n + Math.max(1, Number(i.quantity) || 1), 0);

// IMPORTANT: these live OUTSIDE AssetNew. Defining them inside re-creates them on
// every keystroke, which remounts the input and kills focus.
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function AssetNew() {
  const [form, setForm] = useState(empty);
  const [depts, setDepts] = useState([]);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState(null); // { file_path, file_name, extracted }

  useEffect(() => { api("/departments").then(setDepts).catch((e) => setError(e.message)); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onExtracted(r) {
    setDoc(r);
    const x = r.extracted;
    if (!x?.items?.length || unitCount(x) > 1) return; // many units: BulkReview takes over
    const it = x.items[0];
    setForm((f) => ({
      ...f,
      type: it.asset_type || f.type,
      serial_no: it.serial_numbers?.[0] || f.serial_no,
      vendor: x.vendor || f.vendor,
      cost: it.unit_cost ?? f.cost,
      purchase_date: x.purchase_date || f.purchase_date,
      warranty_months: x.warranty_months ?? f.warranty_months,
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { asset, qr } = await api("/assets", {
        method: "POST",
        body: { ...form, document_path: doc?.file_path, document_name: doc?.file_name, extracted_json: doc?.extracted },
      });
      const dept = depts.find((d) => d.id === asset.department_id);
      setCreated({ ...asset, qr, departments: dept ? { name: dept.name } : null });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="rise mx-auto max-w-sm space-y-4">
        <div className="text-center print:hidden">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h1 className="mt-2 text-2xl font-extrabold">Asset registered</h1>
          <p className="font-mono text-sm text-slate-500">{created.id}</p>
        </div>
        <QRCard asset={created} />
        <div className="grid grid-cols-2 gap-3 print:hidden">
          <Link to={`/asset/${created.id}`} className="btn btn-primary">Open passport</Link>
          <button className="btn btn-ghost" onClick={() => { setCreated(null); setForm(empty); setDoc(null); }}>
            Register another
          </button>
        </div>
      </div>
    );
  }

  if (unitCount(doc?.extracted) > 1) {
    return <BulkReview doc={doc} depts={depts} onCancel={() => setDoc(null)} />;
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Register Asset</h1>
        <p className="text-sm text-slate-500">Upload an invoice to autofill, or enter the details by hand.</p>
      </div>

      <UploadExtract onResult={onExtracted} />
      {doc?.extracted && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          ✓ AI filled the fields from <b>{doc.file_name}</b>. Please review them before registering.
        </p>
      )}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <Section title="Basic details">
        <Field label="Asset type *">
          <input required list="asset-types" className="input" placeholder="Desktop Computer" value={form.type} onChange={set("type")} />
          <datalist id="asset-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Department">
          <select className="input" value={form.department_id} onChange={set("department_id")}>
            <option value="">Select...</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Location">
          <input className="input" placeholder="CSE Lab 2" value={form.location} onChange={set("location")} />
        </Field>
        <Field label="Serial number">
          <input className="input" value={form.serial_no} onChange={set("serial_no")} />
        </Field>
      </Section>

      <Section title="Purchase">
        <Field label="Vendor">
          <input className="input" value={form.vendor} onChange={set("vendor")} />
        </Field>
        <Field label="Cost (₹)">
          <input type="number" min="0" inputMode="decimal" className="input" value={form.cost} onChange={set("cost")} />
        </Field>
        <Field label="Purchase date">
          <input type="date" className="input" value={form.purchase_date} onChange={set("purchase_date")} />
        </Field>
        <Field label="Warranty (months)">
          <input type="number" min="0" inputMode="numeric" className="input" value={form.warranty_months} onChange={set("warranty_months")} />
        </Field>
      </Section>

      <Section title="Maintenance">
        <Field label="Next maintenance">
          <input type="date" className="input" value={form.next_maintenance} onChange={set("next_maintenance")} />
        </Field>
      </Section>

      <button disabled={busy} className="btn btn-primary w-full py-3 text-base sm:w-auto sm:px-8">
        {busy ? "Registering..." : "Register & generate QR"}
      </button>
    </form>
  );
}