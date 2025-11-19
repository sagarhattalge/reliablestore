// assets/js/supabase_client.js
// Create or reuse a single Supabase client instance and export it.
// This avoids creating multiple GoTrueClient instances in the same page.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://gugcnntetqarewwnzrki.supabase.co'; // keep your actual values
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg';               // your anon/public key

// If a client is already stored on window, reuse it. This prevents duplicate GoTrue clients.
if (!window.__RS_SUPABASE_CLIENT) {
  window.__RS_SUPABASE_CLIENT = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Export the global instance so modules can import it
export const supabase = window.__RS_SUPABASE_CLIENT;

// Also expose for non-module code and console helpers
window.supabase = supabase;
