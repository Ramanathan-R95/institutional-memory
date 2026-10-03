import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import ChatBubble from "../components/ChatBubble";

const suggestions = [
  "Where is projector P-102?",
  "Who approved the last transfer of CSE-LAB-PC-042?",
  "Which unused computers are available?",
  "Which assets have overdue maintenance?",
  "Show previous projects on IoT transportation",
  "Why was the Lab 1 equipment replaced?",
];

export default function Ask() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(question) {
    const q = (question ?? text).trim();
    if (!q || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.text }));
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setText(""); setBusy(true);
    try {
      const { answer, tools_used } = await api("/ai/ask", { method: "POST", body: { message: q, history }, timeout: 60000 });
      setMsgs((m) => [...m, { role: "assistant", text: answer, tools: tools_used }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: "Sorry, something went wrong: " + e.message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-12rem)] max-w-3xl flex-col md:h-[calc(100dvh-4rem)]">
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {msgs.length === 0 && (
          <div className="rise pt-4 text-center sm:pt-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30">
              <Sparkles size={26} />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Ask your institution</h1>
            <p className="mb-6 mt-1 text-sm text-slate-500">Assets, history, past projects, decisions.</p>
            <div className="grid gap-2 text-left sm:grid-cols-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="card p-3.5 text-sm transition hover:border-indigo-300 hover:bg-indigo-50/50 active:scale-[0.99]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => <ChatBubble key={i} role={m.role} text={m.text} tools={m.tools} />)}
        {busy && (
          <div className="flex items-center gap-1.5 pl-10">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-slate-200 pt-3">
        <input className="input rounded-full px-5 py-3" placeholder="Ask your institution..." value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={busy || !text.trim()} className="btn btn-primary h-12 w-12 shrink-0 rounded-full !p-0" aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}