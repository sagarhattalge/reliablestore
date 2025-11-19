// assets/js/supabase_client.js
// Create or reuse a single Supabase client instance and export it
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Replace these with your project's values if they differ
const SUPABASE_URL = 'https://gugcnntetqarewwnzrki.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg';

if (!window.__RS_SUPABASE_CLIENT) {
  window.__RS_SUPABASE_CLIENT = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// export for module imports
export const supabase = window.__RS_SUPABASE_CLIENT;
// expose for console / inline scripts
window.supabase = supabase;
