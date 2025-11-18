// assets/js/supabase_client.js
// Single client used across pages.
// OPTION A (recommended for Jekyll): Use the Liquid variables (uncomment lines with {{ }})
// OPTION B: Replace the strings with your real values and keep them (if not using Jekyll).

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- Option A: Jekyll replacement (recommended) ---
// Then set values in _config.yml as:
// supabase_url: "https://<project-ref>.supabase.co"
// supabase_anon_key: "<public-anon-key>"
//
// export const SUPABASE_URL = '{{ site.supabase_url }}'
// export const SUPABASE_ANON_KEY = '{{ site.supabase_anon_key }}'

// --- Option B: Direct paste (if you don't use Jekyll Liquid) ---
// Replace the placeholders below with your Project URL and anon key:
export const SUPABASE_URL = 'https://your-project-ref.supabase.co'   // <- REPLACE
export const SUPABASE_ANON_KEY = 'public-anon-key'                  // <- REPLACE

// If you used the Jekyll option, comment out the Option B lines above and uncomment Option A.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
