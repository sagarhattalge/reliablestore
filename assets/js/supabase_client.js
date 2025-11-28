// assets/js/supabase_client.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Project values
const SUPABASE_URL = "https://gugcnntetqarewwnzrki.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg";

// Strong, stable key the site will use
const AUTH_STORAGE_KEY = "rs_supabase_auth_token_v1";

// Create client and force storage to localStorage with our key
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Expose conveniently for other scripts & console
window.supabase = supabase;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Utility: seed SDK from storage (useful to call after a manual localStorage write)
window.seedSdkFromStorage = async function seedSdkFromStorage() {
  try {
    const storageKey = supabase.storageKey || AUTH_STORAGE_KEY;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ok: false, reason: "no token in localStorage", storageKey };

    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    const access_token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.value?.access_token || null;
    const refresh_token = parsed?.refresh_token || parsed?.currentSession?.refresh_token || parsed?.value?.refresh_token || null;
    if (!access_token) return { ok: false, reason: "no access_token in stored token", storageKey };

    const r = await supabase.auth.setSession({ access_token, refresh_token }).catch(e => ({ error: e && e.message }));
    if (r && r.error) return { ok: false, reason: "setSession failed", err: r.error };
    return { ok: true, storageKey, seeded: true };
  } catch (err) {
    return { ok: false, reason: "exception", err: (err && err.message) || err };
  }
};
