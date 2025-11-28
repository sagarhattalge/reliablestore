// assets/js/supabase_client.js
// Stable Supabase client instance for ReliableStore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
 * Project values (safe to store anon key in client)
 * Replace if you ever rotate this key.
 */
const SUPABASE_URL = "https://gugcnntetqarewwnzrki.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg";

/*
 * Force a stable storage key and use window.localStorage explicitly.
 * Some SDK versions/platforms use different keys or storage drivers,
 * so forcing this reduces mismatch issues.
 */
const AUTH_STORAGE_KEY = "rs_supabase_auth_token_v1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // use a stable storage key
    storageKey: AUTH_STORAGE_KEY,
    // persist session explicitly into localStorage (not default storage)
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Make accessible to non-module inline scripts and for debugging
window.supabase = supabase;
// also expose anon key so other modules can fallback
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
