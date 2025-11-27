// assets/js/supabase_client.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Your Supabase project details
const SUPABASE_URL = "https://gugcnntetqarewwnzrki.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg";

// FIX 1: Force Supabase to always use the same stable key
const AUTH_STORAGE_KEY = "rs_supabase_auth_token_v1";

// FIX 2: Force Supabase to use localStorage explicitly
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Expose globally (site_header.js imports it)
window.supabase = supabase;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
