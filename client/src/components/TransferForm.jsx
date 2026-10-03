import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
export default function TransferForm({ asset, onDone }) {
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/transfers", { method: "POST", body: { asset_id: asset.id, to_location: to } });
      setTo("");
      onDone();
      toast("Transfer submitted for approval");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 print:hidden">
      <h2 className="font-semibold mb-2 flex items-center gap-2"><ArrowRightLeft size={16} /> Request transfer</h2>
      <form onSubmit={submit} className="space-y-2">
        <input
          required className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder={`Move from ${asset.location ?? "?"} to...`}
          value={to} onChange={(e) => setTo(e.target.value)}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button disabled={busy} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm disabled:opacity-50">
          {busy ? "Submitting..." : "Submit for approval"}
        </button>
      </form>
    </section>
  );
}