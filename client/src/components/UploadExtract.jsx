import { useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { apiUpload } from "../lib/api";

export default function UploadExtract({ onResult }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      onResult(await apiUpload("/documents/extract", fd));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="border-2 border-dashed border-indigo-300 bg-indigo-50 rounded-xl p-5 text-center">
      <Sparkles className="mx-auto text-indigo-500 mb-1" size={22} />
      <p className="text-sm font-medium">Upload an invoice and let AI fill the form</p>
      <p className="text-xs text-slate-500 mb-3">PDF, PNG or JPG, up to 10 MB</p>
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white cursor-pointer ${busy ? "bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"}`}>
        <Upload size={14} /> {busy ? "Reading invoice..." : "Choose file"}
        <input type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={pick} />
      </label>
      {name && !error && !busy && <p className="text-xs text-slate-500 mt-2">{name}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}