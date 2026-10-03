import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";

export default function Scan() {
  const navigate = useNavigate();
  const [manual, setManual] = useState("");
  const [camError, setCamError] = useState("");
  const scannerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let handled = false;
    const scanner = new Html5Qrcode("qr-reader");

    const starting = scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
        (text) => {
          if (handled || cancelled) return;
          handled = true;
          const match = text.match(/\/asset\/([^/?#]+)/);
          const id = match ? decodeURIComponent(match[1]) : text;
          navigate(`/asset/${encodeURIComponent(id)}`); // unmounting stops the camera below
        },
        () => {}
      )
      .catch((e) => { if (!cancelled) setCamError(String(e)); });

    return () => {
      cancelled = true;
      starting.finally(() => {
        if (scanner.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {});
      });
    };
  }, [navigate]);

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Scan asset QR</h1>
        <p className="text-sm text-slate-500">Point your camera at the label on the equipment.</p>
      </div>

      <div className="card overflow-hidden p-2">
        <div id="qr-reader" className="min-h-[260px] overflow-hidden rounded-xl bg-slate-900" />
      </div>

      {camError && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Camera unavailable. Phones only allow the camera on HTTPS or localhost. Use the box below.
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); manual.trim() && navigate(`/asset/${encodeURIComponent(manual.trim())}`); }}
        className="card space-y-3 p-4">
        <label className="label" htmlFor="manual">Or enter an Asset ID</label>
        <div className="flex gap-2">
          <input id="manual" className="input" placeholder="CSE-LAB-PC-042" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-primary">Open</button>
        </div>
      </form>
    </div>
  );
}