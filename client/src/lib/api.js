import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = [502, 503, 504];

async function request(path, init = {}, { retries = 0, timeout = 30000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const { data } = await supabase.auth.getSession();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(BASE + path, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token}` },
        signal: ctrl.signal,
      });
      if (res.status === 401 && attempt === 0) { await supabase.auth.refreshSession(); continue; }
      if (TRANSIENT.includes(res.status) && attempt < retries) { await sleep(1500 * (attempt + 1)); continue; }

      const json = await res.json().catch(() => { throw new Error("The server returned an unexpected response."); });
      if (!res.ok) { const err = new Error(json.error || res.statusText); err.status = res.status; throw err; }
      return json;
    } catch (e) {
      const network = e.name === "AbortError" || e instanceof TypeError;
      if (network && attempt < retries) { await sleep(1500 * (attempt + 1)); continue; }
      if (e.name === "AbortError") throw new Error("The server took too long to respond. Please try again.");
      if (e instanceof TypeError) throw new Error("Can't reach the server. Check your connection.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const api = (path, { method = "GET", body, timeout } = {}) =>
  request(
    path,
    { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined },
    { retries: method === "GET" ? 2 : 0, timeout }
  );

export const apiUpload = (path, formData) =>
  request(path, { method: "POST", body: formData }, { timeout: 60000 });