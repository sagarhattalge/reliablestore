// assets/js/supabase_client.js
// Creates a single Supabase client instance with deterministic auth storage.
// Uses ESM build from esm.sh (no bundler required).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://gugcnntetqarewwnzrki.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg";

// Use a stable storage key so the SDK and our code always read/write the same localStorage key.
const AUTH_STORAGE_KEY = "rs_supabase_auth_token_v1";

// Create client and force it to use window.localStorage with our storage key.
if (!window.__RS_SUPABASE_CLIENT) {
  window.__RS_SUPABASE_CLIENT = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      storage: window.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}

export const supabase = window.__RS_SUPABASE_CLIENT;
window.supabase = supabase; // convenience for console debugging
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
