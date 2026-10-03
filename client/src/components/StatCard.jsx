const tones = {
  slate: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  orange: "bg-orange-100 text-orange-600",
  indigo: "bg-indigo-100 text-indigo-600",
};

export default function StatCard({ label, value, tone = "slate", icon: Icon }) {
  return (
    <div className="card h-full p-4 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-snug text-slate-500">{label}</span>
        {Icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={16} /></span>
        )}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}