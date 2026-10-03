import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import { api } from "../lib/api";

const color = {
  project: "#4f46e5", decision: "#d97706", procedure: "#16a34a", meeting: "#64748b",
  person: "#ec4899", asset: "#0891b2", department: "#8b5cf6",
};

export default function Graph() {
  const navigate = useNavigate();
  const box = useRef(null);
  const [width, setWidth] = useState(700);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/knowledge").then((d) => {
      setItems(d);
      const first = d.find((k) => k.kind === "project") ?? d[0];
      if (first) setSelected(String(first.id));
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setError("");
    api(`/graph/knowledge/${selected}`).then(setData).catch((e) => setError(e.message));
  }, [selected]);

  useEffect(() => {
    const measure = () => box.current && setWidth(box.current.clientWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const paint = (n, ctx, scale) => {
    const r = n.center ? 9 : 5;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color[n.group] ?? "#94a3b8"; ctx.fill();
    const fs = 11 / scale;
    ctx.font = `${n.center ? "bold " : ""}${fs}px sans-serif`;
    ctx.textAlign = "center"; ctx.fillStyle = "#1e293b";
    const text = n.label.length > 30 ? n.label.slice(0, 28) + "…" : n.label;
    ctx.fillText(text, n.x, n.y + r + fs);
  };

  const onClick = (n) => {
    if (n.group === "asset") navigate(`/asset/${n.ref_id}`);
    else if (n.ref_id && ["project", "decision", "procedure", "meeting"].includes(n.group)) setSelected(String(n.ref_id));
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold">Knowledge Graph</h1>
      <p className="text-sm text-slate-500">
        See how a project connects to students, faculty, hardware and related work. Click a project node to re-center, or an asset node to open it.
      </p>

      <select value={selected} onChange={(e) => setSelected(e.target.value)} className="border rounded-lg px-3 py-2 bg-white w-full md:w-96">
        {items.map((k) => <option key={k.id} value={k.id}>{k.kind}: {k.title}</option>)}
      </select>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(color).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1 capitalize">
            <span className="w-3 h-3 rounded-full" style={{ background: c }} /> {k}
          </span>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div ref={box} className="bg-white border rounded-xl overflow-hidden">
        {data && (
          <ForceGraph2D
            key={selected}
            graphData={data}
            width={width} height={width < 640 ? 380 : 520}
            nodeCanvasObject={paint}
            nodePointerAreaPaint={(n, c, ctx) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(n.x, n.y, 9, 0, 2 * Math.PI); ctx.fill(); }}
            linkColor={() => "#cbd5e1"}
            linkDirectionalArrowLength={3}
            linkLabel="label"
            onNodeClick={onClick}
            cooldownTicks={80}
          />
        )}
      </div>
    </div>
  );
}