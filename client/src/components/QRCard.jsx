import { Printer } from "lucide-react";

export default function QRCard({ asset }) {
  return (
    <div className="card break-inside-avoid p-4 text-center">
      <div className="mx-auto w-full max-w-[12rem] rounded-2xl bg-white p-2 ring-1 ring-slate-200">
        <img src={asset.qr} alt={`QR for ${asset.id}`} className="w-full" />
      </div>
      <div className="mt-3 break-all font-mono text-sm font-bold">{asset.id}</div>
      <div className="text-xs text-slate-500">{asset.type} · {asset.departments?.name}</div>
      <button onClick={() => window.print()} className="btn btn-ghost mt-3 w-full print:hidden">
        <Printer size={15} /> Print label
      </button>
    </div>
  );
}