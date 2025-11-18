// assets/js/supabase_client.js
// IMPORTANT: Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project's values.
// Use the anon/public key here. NEVER put the service_role key in client code.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://gugcnntetqarewwnzrki.supabase.co';        // <-- replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg';              // <-- replace

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
