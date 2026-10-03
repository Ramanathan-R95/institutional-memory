import { ShoppingCart, UserCheck, ArrowRightLeft, Wrench, Undo2 } from "lucide-react";

const meta = {
  purchased: { icon: ShoppingCart, color: "bg-blue-500", label: "Purchased" },
  assigned: { icon: UserCheck, color: "bg-green-500", label: "Assigned" },
  transferred: { icon: ArrowRightLeft, color: "bg-indigo-500", label: "Transferred" },
  maintained: { icon: Wrench, color: "bg-amber-500", label: "Maintained" },
  returned: { icon: Undo2, color: "bg-slate-500", label: "Returned" },
};

export default function Timeline({ events }) {
  if (!events?.length) return <p className="text-slate-500 text-sm">No history yet.</p>;

  return (
    <ol className="relative border-l-2 border-slate-200 ml-3 space-y-5">
      {events.map((e) => {
        const m = meta[e.event_type] ?? meta.assigned;
        const Icon = m.icon;
        return (
          <li key={e.id} className="ml-6">
            <span className={`absolute -left-[13px] w-6 h-6 rounded-full flex items-center justify-center text-white ${m.color}`}>
              <Icon size={13} />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{m.label}</span>
              <time className="text-xs text-slate-500">{new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time>
            </div>
            <div className="text-sm text-slate-600">
              {e.from_location && e.to_location && <>From <b>{e.from_location}</b> to <b>{e.to_location}</b></>}
              {!e.from_location && e.to_location && <>To <b>{e.to_location}</b></>}
              {e.to_user_name && <> · Custodian: {e.to_user_name}</>}
            </div>
            {e.approved_by_name && <div className="text-xs text-slate-500">Approved by {e.approved_by_name}</div>}
            {e.notes && <div className="text-xs text-slate-500 italic">{e.notes}</div>}
          </li>
        );
      })}
    </ol>
  );
}