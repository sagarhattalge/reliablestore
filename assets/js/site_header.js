// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

// Edge function URL (deployed)
const CHECK_IDENTIFIER_ENDPOINT =
  (supabase?.supabaseUrl || 'https://gugcnntetqarewwnzrki.supabase.co').replace(/\/$/, '') +
  '/functions/v1/check-identifier';

// IMPORTANT: this is the anon key (safe to be public). We send it so Edge Function can validate/accept the call.
const SUPABASE_ANON_KEY = supabase?.supabaseKey || 'PASTE_ANON_KEY_HERE';

// Prevent accidental auto-open
window.__rs_block_auto_modal = true;

/* helpers */
const $ = s => document.querySelector(s);
const $all = s => Array.from(document.querySelectorAll(s));
const getReturnTo = () => window.location.pathname + window.location.search + window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || '/');

/* cart helpers (kept same) */
function readCart(){ try { return JSON.parse(localStorage.getItem('rs_cart_v1')||'{}'); } catch(e){ return {}; } }
function cartTotalCount(){ const c = readCart(); return Object.values(c).reduce((s,i)=>s+(i.qty||0),0); }
function setCartCount(n){ const e1 = document.getElementById('cart-count'); const e2 = document.getElementById('cart_count'); if (e1) e1.innerText = String(n||0); if (e2) e2.innerText = String(n||0); }

/* modal helpers (kept same) */
function _disablePageForModal(){ const main=document.querySelector('main')||document.body; try{ main.inert=true; }catch(e){ main.setAttribute('aria-hidden','true'); } }
function _restorePageAfterModal(){ const main=document.querySelector('main')||document.body; try{ main.inert=false; }catch(e){ main.removeAttribute('aria-hidden'); } }

let ignoreDocumentClick = false;
function openModal(opts={}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) return;
  const m = $('#rs-auth-modal'); if(!m) return;
  m.style.display='flex'; m.style.alignItems='center'; m.style.justifyContent='center';
  m.classList.remove('hidden'); m.removeAttribute('aria-hidden'); _disablePageForModal();
  ignoreDocumentClick = true; setTimeout(()=>{ ignoreDocumentClick=false; },160);
  setTimeout(()=>{ const input=m.querySelector('input,button,[tabindex]:not([tabindex="-1"])'); if(input) try{input.focus()}catch(_){ } },80);
}
function closeModal(){ const m=$('#rs-auth-modal'); if(!m) return; m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); m.style.display='none'; _restorePageAfterModal(); const toggle=document.getElementById('rs-header-login-toggle')||document.getElementById('btn_login'); if(toggle) try{ toggle.focus() }catch(_){} }
function showStep(id){ $all('.rs-step').forEach(s=>s.classList.add('hidden')); const el=document.getElementById(id); if(el) el.classList.remove('hidden'); }

/* Supabase auth usage (client) */
async function signInWithPassword(email, password){
  try { return await supabase.auth.signInWithPassword({ email, password }); } catch(e){ return { error: e }; }
}
async function signUpWithEmail(email, password, metadata = {}){
  try { return await supabase.auth.signUp({ email, password, options: { data: metadata } }); } catch(e){ return { error: e }; }
}

/* --> THIS function calls the Edge Function and sends the anon key in header <-- */
async function checkExistingByEmail(identifier) {
  try {
    const res = await fetch(CHECK_IDENTIFIER_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        // These headers are required by the Edge Function for auth; ensure your Edge function returns Access-Control-Allow-Headers including 'apikey' and 'authorization'
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ identifier: String(identifier || '') })
    });

    if (!res.ok) {
      const body = await res.text().catch(()=>'<no body>');
      console.warn('check-identifier endpoint non-OK', res.status, body);
      return null;
    }
    const json = await res.json().catch(()=>null);
    if (!json || typeof json.exists !== 'boolean') { console.warn('check-identifier unexpected response', json); return null; }
    return json; // { exists: boolean, email?: string }
  } catch (err) {
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}

// Expose for console tests
window.checkExistingByEmail = checkExistingByEmail;

/* setupAuthModal wiring (unchanged except uses checkExistingByEmail above) */
function setupAuthModal(){
  const toggle = document.getElementById('rs-header-login-toggle') || document.getElementById('btn_login');
  const modal = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) return;

  modal.style.position = modal.style.position || 'fixed';
  modal.style.inset = modal.style.inset || '0';
  modal.style.display = modal.style.display || 'none';
  modal.style.zIndex = modal.style.zIndex || '1200';
  modal.style.alignItems = modal.style.alignItems || 'center';
  modal.style.justifyContent = modal.style.justifyContent || 'center';

  const identifierInput = document.getElementById('rs-identifier');
  const identifierNext = document.getElementById('rs-identifier-next');
  const identifierError = document.getElementById('rs-identifier-error');

  const knownEmailText = document.getElementById('rs-known-email');
  const passwordInput = document.getElementById('rs-password');
  const signinBtn = document.getElementById('rs-signin-btn');
  const passwordError = document.getElementById('rs-password-error');
  const backToEnter = document.getElementById('rs-back-to-enter');

  const signupEmail = document.getElementById('rs-signup-email');
  const signupName = document.getElementById('rs-signup-name');
  const signupPassword = document.getElementById('rs-signup-password');
  const signupBtn = document.getElementById('rs-signup-btn');
  const signupError = document.getElementById('rs-signup-error');
  const cancelSignup = document.getElementById('rs-cancel-signup');
  const closeBtns = $all('[data-rs-close]');

  toggle.addEventListener('click', (e)=>{ try{ e.preventDefault(); e.stopPropagation(); }catch(_){ } openModal({force:true}); showStep('rs-step-enter'); if (identifierInput){ identifierInput.value=''; identifierInput.focus() } if (identifierError) identifierError.textContent=''; });

  closeBtns.forEach(b=>b.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){ } closeModal(); }));

  document.addEventListener('mousedown', (ev)=>{ if (ignoreDocumentClick) return; try{ const m=document.getElementById('rs-auth-modal'); if(!m|| m.classList.contains('hidden')) return; const panel=m.querySelector('.rs-modal-panel'); if(!panel) return; if(!panel.contains(ev.target)) closeModal(); }catch(e){} });

  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

  if (backToEnter) backToEnter.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){}; showStep('rs-step-enter'); });

  if (identifierNext) identifierNext.addEventListener('click', async (e)=>{
    try {
      try{ e.preventDefault(); }catch(_){}; if (identifierError) identifierError.textContent=''; const raw = (identifierInput?.value||'').trim(); if(!raw){ if(identifierError) identifierError.textContent='Please enter your email or mobile number'; return; }

      if (/^\d{10,}$/.test(raw)) {
        identifierNext.disabled = true;
        const r = await checkExistingByEmail(raw);
        identifierNext.disabled = false;
        if (r === null) { if (identifierError) identifierError.textContent='Unable to check right now'; return; }
        if (r.exists && r.email) { knownEmailText.textContent = r.email; if(passwordInput) passwordInput.value=''; showStep('rs-step-password'); return; }
        if (r.exists) { showStep('rs-step-password'); return; }
        signupEmail && (signupEmail.value=''); signupName && (signupName.value=''); signupPassword && (signupPassword.value=''); showStep('rs-step-signup'); signupEmail && signupEmail.focus(); return;
      }

      const email = raw;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if(identifierError) identifierError.textContent='Please enter a valid email address'; return; }
      identifierNext.disabled = true;
      const r = await checkExistingByEmail(email);
      identifierNext.disabled = false;
      if (r === null) { if(identifierError) identifierError.textContent='Unable to check right now'; return; }
      if (r.exists) { if (knownEmailText) knownEmailText.textContent = r.email || email; if(passwordInput) passwordInput.value=''; showStep('rs-step-password'); if(passwordError) passwordError.textContent=''; }
      else { if(signupEmail) signupEmail.value = email; if(signupName) signupName.value=''; if(signupPassword) signupPassword.value=''; showStep('rs-step-signup'); signupPassword && signupPassword.focus(); }
    } catch(err) { console.error('identifier handler error', err); if(identifierError) identifierError.textContent='Unexpected error. See console.'; }
  });

  // signin & signup handlers (unchanged from earlier — use supabase client)
  if (signinBtn) signinBtn.addEventListener('click', async (e)=>{
    try{ e.preventDefault(); if(passwordError) passwordError.textContent=''; const email = (knownEmailText?.textContent||'').trim(); const pw = (passwordInput?.value||'').trim(); if(!email||!pw){ if(passwordError) passwordError.textContent='Enter your password'; return; }
      signinBtn.disabled = true; const res = await signInWithPassword(email,pw); signinBtn.disabled = false;
      if (res.error) { if (passwordError) passwordError.textContent = res.error.message || 'Sign in failed'; return; }
      try { if(!res.error && res.data?.session) await supabase.auth.setSession({ access_token: res.data.session.access_token, refresh_token: res.data.session.refresh_token }); } catch(e){ console.warn('setSession failed', e); }
      closeModal(); const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded(); window.location.href = decodeURIComponent(rt||'/');
    }catch(err){ console.error('signin error',err); if(passwordError) passwordError.textContent='Unexpected error. See console.'; try{ signinBtn.disabled=false }catch(_){ } }
  });

  if (signupBtn) signupBtn.addEventListener('click', async (e)=>{
    try{ e.preventDefault(); if(signupError) signupError.textContent=''; const email=(signupEmail?.value||'').trim(); const name=(signupName?.value||'').trim(); const pw=(signupPassword?.value||'').trim(); if(!email||!name||!pw){ if(signupError) signupError.textContent='Fill name, email and password'; return; } if(pw.length<6){ if(signupError) signupError.textContent='Password must be at least 6 characters'; return; }
      signupBtn.disabled=true; const res = await signUpWithEmail(email,pw,{ full_name: name }); signupBtn.disabled=false; if(res.error){ if(signupError) signupError.textContent = res.error.message || 'Signup failed'; return; }
      closeModal(); const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded(); window.location.href = decodeURIComponent(rt||'/');
    }catch(err){ console.error('signup error',err); if(signupError) signupError.textContent='Unexpected error. See console.'; try{ signupBtn.disabled=false }catch(_){ } }
  });

  if (cancelSignup) cancelSignup.addEventListener('click', (e)=>{ try{ e.preventDefault() }catch(_){}; showStep('rs-step-enter'); });

} // setupAuthModal end

export function renderHeaderExtras(){
  setCartCount(cartTotalCount());
  window.addEventListener('storage', ()=>setCartCount(cartTotalCount()));
  try{ setupAuthModal(); } catch(e){ console.warn('setupAuthModal error', e); }
  const toggle=document.getElementById('rs-header-login-toggle'); const logoutBtn=document.getElementById('rs-logout-btn');
  function setUi(logged){ if(toggle) toggle.style.display = logged? 'none': ''; if(logoutBtn) logoutBtn.style.display = logged? '': 'none'; }
  async function refreshAuthUI(){
    try{ const userRes = await Promise.race([ supabase.auth.getUser(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('getUser timeout')),6000)) ]); const user = userRes?.data?.user || userRes?.user || null; setUi(!!user); if(user) return; }catch(e){ console.warn('supabase.getUser failed', e); }
    try { const storageKey = supabase.storageKey || ('sb-'+(supabase.supabaseUrl||'').replace(/https?:\/\//,'').split('.')[0]+'-auth-token'); const raw = localStorage.getItem(storageKey); if(!raw){ setUi(false); return; } let parsed; try{ parsed = JSON.parse(raw);}catch(_){ parsed=null;} const access_token = parsed?.access_token||parsed?.currentSession?.access_token||parsed?.value?.access_token; if(!access_token){ setUi(false); return; } const url = (supabase.supabaseUrl||'').replace(/\/$/,'') + '/auth/v1/user'; const resp = await fetch(url,{ method:'GET', headers:{ 'Authorization':'Bearer '+access_token, 'apikey': supabase.supabaseKey }, mode:'cors', cache:'no-store' }); setUi(resp.status===200); } catch(e){ console.warn('fallback token check failed', e); setUi(false); }
  }
  try{ supabase.auth.onAuthStateChange(()=>{ refreshAuthUI().catch((e)=>console.warn('refreshAuthUI error', e)); }); }catch(_){}
  refreshAuthUI().catch((e)=>console.warn('initial refreshAuthUI error', e));
  if (logoutBtn) logoutBtn.addEventListener('click', async (e)=>{ try{ e.preventDefault&&e.preventDefault(); }catch(_){} try{ await supabase.auth.signOut().catch(()=>{}); }catch(_){} try{ const storageKey = supabase.storageKey || ('sb-'+(supabase.supabaseUrl||'').replace(/https?:\/\//,'').split('.')[0]+'-auth-token'); localStorage.removeItem(storageKey); }catch(_){ } try{ alert('You have been logged out.'); }catch(_){ } window.location.href = '/'; });
}

document.addEventListener('DOMContentLoaded', ()=>{ try{ renderHeaderExtras(); }catch(e){ console.warn('renderHeaderExtras error', e); } });
