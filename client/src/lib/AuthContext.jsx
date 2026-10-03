import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { api } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waking, setWaking] = useState(false);
  const loadedFor = useRef(null);

  async function loadProfile(session) {
    if (!session) { loadedFor.current = null; setUser(null); setLoading(false); return; }
    if (loadedFor.current === session.user.id) return; // already loaded, ignore tab-focus events

    for (let i = 0; i < 4; i++) {
      try {
        setUser(await api("/me"));
        loadedFor.current = session.user.id;
        setWaking(false); setLoading(false);
        return;
      } catch (e) {
        if (e.status === 401 || e.status === 403) { await supabase.auth.signOut(); break; }
        setWaking(true); // server asleep or offline: keep the session and retry
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    setWaking(false); setUser(null); setLoading(false);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      // setTimeout avoids calling supabase inside its own auth callback
      setTimeout(() => loadProfile(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const logout = () => supabase.auth.signOut();

  return <Ctx.Provider value={{ user, loading, waking, login, logout }}>{children}</Ctx.Provider>;
}