import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://gugcnntetqarewwnzrki.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z2NubnRldHFhcmV3d256cmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjEyODEsImV4cCI6MjA3OTAzNzI4MX0.xKcKckmgf1TxbtEGzjHWqjcx-98ni9UdCgvFE9VIwpg";

// Create the client (this version correctly sets supabase.supabaseKey)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose for non-module scripts
window.supabase = supabase;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
