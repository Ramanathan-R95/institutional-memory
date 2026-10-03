import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
import {
  LayoutDashboard, Boxes, ScanLine, LogOut, PlusCircle, ArrowRightLeft,
  Sparkles, BookOpen, Bell, Network, Menu, Landmark,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";

const links = [
  { to: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/assets", label: "Assets", short: "Assets", icon: Boxes },
  { to: "/assets/new", label: "Register asset", icon: PlusCircle, roles: ["admin"] },
  { to: "/transfers", label: "Transfers", icon: ArrowRightLeft, roles: ["admin", "faculty"] },
  { to: "/ask", label: "Ask AI", short: "Ask", icon: Sparkles },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/graph", label: "Graph", icon: Network },
  { to: "/alerts", label: "Alerts", icon: Bell, roles: ["admin", "faculty"] },
  { to: "/scan", label: "Scan QR", short: "Scan", icon: ScanLine },
];
const TAB_ORDER = ["/", "/assets", "/scan", "/ask"]; // bottom bar on mobile

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
        <Landmark size={18} />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-bold text-white">Institutional Memory</div>
        <div className="text-[11px] text-slate-400">Asset Traceability</div>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  const initials = name.replace(/\(.*?\)/g, "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-indigo-400 to-fuchsia-500 text-xs font-bold text-white">
      {initials}
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(false);

  const visible = links.filter((l) => !l.roles || l.roles.includes(user.role));
  const tabs = TAB_ORDER.map((to) => visible.find((l) => l.to === to)).filter(Boolean);
  const more = visible.filter((l) => !TAB_ORDER.includes(l.to));
  const location = useLocation();
  useEffect(() => {
    const l = links.find((x) => x.to === location.pathname);
    document.title = `${l ? l.label + " · " : ""}Institutional Memory`;
  }, [location.pathname]);
  async function signOut() { await logout(); navigate("/login"); }

  return (
    <div className="min-h-screen md:flex">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-linear-to-b from-slate-900 via-slate-900 to-indigo-950 p-4 text-slate-300 md:flex print:hidden">
        <Brand />
        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
          {visible.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-white ring-1 ring-white/10" : "hover:bg-white/5 hover:text-white"}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 pt-4">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="text-xs capitalize text-slate-400">{user.role}</div>
          </div>
          <button onClick={signOut} title="Sign out" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:hidden print:hidden">
        <Brand />
        <Avatar name={user.name} />
      </header>

      {/* ---------- Page ---------- */}
      <main className="min-w-0 flex-1 p-4 pb-28 sm:p-6 md:pb-8 lg:p-8 print:p-0">
        <div className="mx-auto w-full max-w-6xl">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-slate-200/70" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* ---------- Mobile bottom tab bar ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        <div className="grid grid-cols-5 items-end px-1">
          {tabs.map(({ to, short, icon: Icon }) =>
            to === "/scan" ? (
              <NavLink key={to} to={to} className="-mt-5 flex flex-col items-center pb-1.5 text-[11px] font-medium text-slate-500">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/40 ring-4 ring-white">
                  <Icon size={24} />
                </span>
                <span className="mt-0.5">{short}</span>
              </NavLink>
            ) : (
              <NavLink key={to} to={to} end
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? "text-indigo-600" : "text-slate-500"}`}>
                <Icon size={21} /> {short}
              </NavLink>
            )
          )}
          <button onClick={() => setSheet(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-slate-500">
            <Menu size={21} /> More
          </button>
        </div>
      </nav>

      {/* ---------- Mobile "More" sheet ---------- */}
      {sheet && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSheet(false)} />
          <div className="sheet-in absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={user.name} />
              <div>
                <div className="font-semibold">{user.name}</div>
                <div className="text-xs capitalize text-slate-500">{user.role}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {more.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setSheet(false)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 px-2 py-4 text-center text-xs font-medium text-slate-700 active:bg-indigo-50">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600"><Icon size={18} /></span>
                  {label}
                </NavLink>
              ))}
            </div>
            <button onClick={signOut} className="btn btn-ghost mt-4 w-full text-red-600"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}