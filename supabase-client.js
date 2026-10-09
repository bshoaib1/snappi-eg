/* SNAPPI SUPABASE BROWSER CLIENT
   Minimal Auth and REST wrapper for the static GitHub Pages deployment. */
(() => {
  "use strict";
  const config = window.SNAPPI_SUPABASE;
  const storageKey = "snappi-supabase-session";
  const activityKey = "snappi-auth-last-activity";
  const DEFAULT_IDLE_LIMIT_MS = 10 * 60 * 1000;
  let inactivityTimer = null;
  let inactivityHandler = null;
  let inactivityRunning = false;
  if (!config?.url || !config?.publishableKey) throw new Error("Supabase configuration is missing.");

  const readSession = () => {
    try {
      localStorage.removeItem(storageKey);
      return JSON.parse(sessionStorage.getItem(storageKey) || "null");
    }
    catch { sessionStorage.removeItem(storageKey); return null; }
  };
  const saveSession = (session) => {
    localStorage.removeItem(storageKey);
    if (session) sessionStorage.setItem(storageKey, JSON.stringify(session));
    else sessionStorage.removeItem(storageKey);
  };
  const authHeaders = (token) => ({ apikey: config.publishableKey, Authorization: `Bearer ${token || config.publishableKey}`, "Content-Type": "application/json" });
  const parseResponse = async (response) => {
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.hint || `Request failed (${response.status})`);
    return data;
  };
  const refreshSession = async (session) => {
    if (!session?.refresh_token) return null;
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ refresh_token: session.refresh_token }) });
    const next = await parseResponse(response);
    saveSession(next);
    return next;
  };
  const getSession = async () => {
    let session = readSession();
    if (!session) return null;
    const expiresAt = session.expires_at || 0;
    if (expiresAt * 1000 <= Date.now() + 30000) {
      try { session = await refreshSession(session); }
      catch { saveSession(null); return null; }
    }
    return session;
  };

  // Shared inactivity protection for every authenticated Snappi workspace.
  // Admin, creator, and brand pages call this after a successful sign-in.
  const stopInactivityTimeout = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
    if (!inactivityHandler) return;
    inactivityHandler.events.forEach((eventName) => window.removeEventListener(eventName, inactivityHandler.record));
    window.removeEventListener("storage", inactivityHandler.storage);
    document.removeEventListener("visibilitychange", inactivityHandler.visibility);
    inactivityHandler = null;
  };

  window.snappiSupabase = Object.freeze({
    adoptSession(session) { saveSession(session); },
    async signIn(email, password) {
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ email, password }) });
      const session = await parseResponse(response);
      saveSession(session);
      // Start each successful login with a fresh activity window. A timestamp
      // left by an earlier session must never immediately expire the new one.
      localStorage.setItem(activityKey, String(Date.now()));
      return session;
    },
    async signOut() {
      stopInactivityTimeout();
      const session = await getSession();
      if (session) await fetch(`${config.url}/auth/v1/logout`, { method: "POST", headers: authHeaders(session.access_token) }).catch(() => {});
      saveSession(null);
      localStorage.removeItem(activityKey);
    },
    startInactivityTimeout({ timeoutMs = DEFAULT_IDLE_LIMIT_MS, onTimeout } = {}) {
      stopInactivityTimeout();
      const events = ["pointerdown", "keydown", "scroll", "touchstart"];
      const lastActivity = () => Number(localStorage.getItem(activityKey)) || Date.now();
      const schedule = () => {
        clearTimeout(inactivityTimer);
        const remaining = Math.max(0, timeoutMs - (Date.now() - lastActivity()));
        inactivityTimer = window.setTimeout(check, remaining + 100);
      };
      const check = async () => {
        if (inactivityRunning) return;
        if (Date.now() - lastActivity() < timeoutMs) return schedule();
        inactivityRunning = true;
        try {
          await window.snappiSupabase.signOut();
          localStorage.removeItem(activityKey);
          if (typeof onTimeout === "function") onTimeout();
        } finally { inactivityRunning = false; }
      };
      const record = () => {
        const now = Date.now();
        if (now - lastActivity() < 1000) return;
        localStorage.setItem(activityKey, String(now));
        schedule();
      };
      const storage = (event) => { if (event.key === activityKey) schedule(); };
      const visibility = () => { if (!document.hidden) check(); };
      inactivityHandler = { events, record, storage, visibility };
      events.forEach((eventName) => window.addEventListener(eventName, record, { passive: true }));
      window.addEventListener("storage", storage);
      document.addEventListener("visibilitychange", visibility);
      if (!localStorage.getItem(activityKey)) localStorage.setItem(activityKey, String(Date.now()));
      schedule();
    },
    stopInactivityTimeout,
    getSession,
    async requestPasswordReset(email, redirectTo) {
      const response = await fetch(`${config.url}/functions/v1/public-password-recovery`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ email, redirectTo }) });
      return parseResponse(response);
    },
    async updatePassword(accessToken, password) {
      const response = await fetch(`${config.url}/auth/v1/user`, { method: "PUT", headers: authHeaders(accessToken), body: JSON.stringify({ password, data: { must_change_password: false } }) });
      return parseResponse(response);
    },
    async updateEmail(email) {
      const session = await getSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`${config.url}/auth/v1/user`, { method: "PUT", headers: authHeaders(session.access_token), body: JSON.stringify({ email }) });
      return parseResponse(response);
    },
    async rpc(functionName, body = {}) {
      const session = await getSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, { method: "POST", headers: authHeaders(session.access_token), body: JSON.stringify(body) });
      return parseResponse(response);
    },
    async invoke(functionName, body = {}) {
      const session = await getSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`${config.url}/functions/v1/${functionName}`, { method: "POST", headers: authHeaders(session.access_token), body: JSON.stringify(body) });
      return parseResponse(response);
    },
    async publicInvoke(functionName, body = {}) {
      const response = await fetch(`${config.url}/functions/v1/${functionName}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      return parseResponse(response);
    },
    async publicRest(table, { query = "" } = {}) {
      const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, { headers: authHeaders() });
      return parseResponse(response);
    },
    async createSignedUrl(bucket, path, expiresIn = 300) {
      const session = await getSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const safePath = String(path).split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`${config.url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${safePath}`, { method: "POST", headers: authHeaders(session.access_token), body: JSON.stringify({ expiresIn }) });
      const data = await parseResponse(response);
      const signedPath = data.signedURL || data.signedUrl;
      return signedPath?.startsWith("http") ? signedPath : `${config.url}/storage/v1${signedPath}`;
    },
    async rest(table, { query = "", method = "GET", body, prefer = "return=representation" } = {}) {
      const session = await getSession();
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const headers = { ...authHeaders(session.access_token), Prefer: prefer };
      const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      return parseResponse(response);
    }
  });
})();
