import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Landmark } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

const demo = [
  { label: "Admin", email: "admin@demo.com" },
  { label: "HOD", email: "hod@demo.com" },
  { label: "Student", email: "student@demo.com" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl" />
      <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-fuchsia-600/30 blur-3xl" />

      <div className="rise relative w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-500 shadow-xl shadow-indigo-500/30">
            <Landmark size={26} />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Institutional Memory</h1>
          <p className="mt-1 text-sm text-slate-300">Every asset. Every decision. Remembered.</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6 shadow-2xl sm:p-8">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="btn btn-primary w-full py-3">{busy ? "Signing in..." : "Sign in"}</button>

          <div className="border-t pt-4">
            <p className="mb-2 text-center text-xs text-slate-400">Quick demo login</p>
            <div className="grid grid-cols-3 gap-2">
              {demo.map((d) => (
                <button type="button" key={d.label} onClick={() => setEmail(d.email)}
                  className={`chip justify-center ${email === d.email ? "chip-active" : ""}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}