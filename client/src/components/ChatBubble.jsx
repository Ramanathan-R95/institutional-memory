import { Link } from "react-router-dom";
import { Wrench, Sparkles } from "lucide-react";

const ID_RE = /\b([A-Z]{2,5}(?:-[A-Z0-9]+)*-\d{3})\b/g;

function withLinks(text) {
  return text.split(ID_RE).map((part, i) =>
    i % 2 === 1
      ? <Link key={i} to={`/asset/${part}`} className="font-mono font-semibold text-indigo-600 underline">{part}</Link>
      : part
  );
}

export default function ChatBubble({ role, text, tools }) {
  const mine = role === "user";
  return (
    <div className={`rise flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-white">
          <Sparkles size={15} />
        </div>
      )}
      <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
        mine ? "rounded-br-md bg-linear-to-br from-indigo-600 to-violet-600 text-white"
             : "rounded-bl-md border border-slate-200 bg-white shadow-sm"}`}>
        {mine ? text : withLinks(text)}
        {tools?.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2 text-xs text-slate-400">
            <Wrench size={11} /> Looked up: {[...new Set(tools.map((t) => t.name))].join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}