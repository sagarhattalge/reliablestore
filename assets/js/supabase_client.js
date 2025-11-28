// assets/js/supabase_client.js
// Stable Supabase client instance for ReliableStore
// - Exposes `supabase` as an ES module export and on window.
// - Forces a stable storageKey so other scripts can reliably read tokens.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Replace these values with your project's info if they differ
const SUPABASE_URL = "https://gugcnntetqarewwnzrki.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg";

// Force a stable storage key used by the SDK and other scripts
const AUTH_STORAGE_KEY = "rs_supabase_auth_token_v1";

// Create client and force localStorage persistence
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Expose to global for code that expects window.supabase or window.SUPABASE_ANON_KEY
window.supabase = supabase;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
