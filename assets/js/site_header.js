// assets/js/site_header.js
// Updated: fixes for modal hang, passive listener errors, auth UI refresh.
import { supabase } from '/assets/js/supabase_client.js';

// prevent accidental auto-open on page load — keep this true unless you actually want auto-open
window.__rs_block_auto_modal = true;

/* ---------- tiny helper to attach listeners safely (ensures passive:false when needed) ---------- */
function on(el, ev, fn, opts = {}){
  if(!el) return;
  try {
    // ensure preventDefault can be used by default
    const opt = Object.assign({ passive: false }, opts);
    el.addEventListener(ev, fn, opt);
  } catch(e){
    // some older browsers may not accept options object
    el.addEventListener(ev, fn, !!opts.capture);
  }
}

/* ---------- DOM helpers ---------- */
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
function getReturnTo(){ return window.location.pathname + window.location.search + window.location.hash; }
function returnToEncoded(){ return encodeURIComponent(getReturnTo() || '/'); }

/* CART helpers (compat) */
function setCartCount(n){
  const el1 = document.getElementById('cart-count');
  const el2 = document.getElementById('cart_count');
  if (el1) el1.innerText = String(n||0);
  if (el2) el2.innerText = String(n||0);
}
function readCart(){ try { return JSON.parse(localStorage.getItem('rs_cart_v1')||'{}'); }catch(e){return{}} }
function cartTotalCount(){ const c = readCart(); return Object.values(c).reduce((s,i)=> s + (i.qty||0), 0); }

/* ---------- modal control (guarded) ---------- */
function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) {
    console.debug('rs-auth-modal open blocked by __rs_block_auto_modal');
    return;
  }
  const m = $('#rs-auth-modal');
  if(!m) return;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden','false');
}
function closeModal(){ const m=$('#rs-auth-modal'); if(!m) return; m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); }
function showStep(id){ $all('.rs-step').forEach(s=> s.classList.add('hidden')); const el = $('#'+id); if(el) el.classList.remove('hidden'); }

/* ---------- Supabase helpers ---------- */
async function checkExistingByEmail(email){
  try {
    const { data, error } = await supabase.from('customers').select('id,email').eq('email', email).limit(1).maybeSingle();
    if (error) { console.warn('customers table check error:', error); return null; }
    return data ? true : false;
  } catch(err){ console.warn('checkExistingByEmail exception', err); return null; }
}
async function signInWithPassword(email, password){
  try { return await supabase.auth.signInWithPassword({ email, password }); } catch(e){ return { error: e }; }
}
async function signUpWithEmail(email, password, metadata = {}){ try { return await supabase.auth.signUp({ email, password, options: { data: metadata } }); } catch(e){ return { error: e }; } }

/* ---------- modal wiring ---------- */
function setupAuthModal(){
  const toggle = document.getElementById('rs-header-login-toggle');
  const modal = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) return;

  // elements
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

  // ensure clicks inside the modal panel do not bubble to document handlers that may close it
  on(modal, 'click', (ev) => { ev.stopPropagation && ev.stopPropagation(); }, { passive: true });

  // open: allow user clicks (force true overrides the auto-block)
  on(toggle, 'click', (e) => { try { e.preventDefault && e.preventDefault(); } catch(_){}; openModal({force:true}); showStep('rs-step-enter'); if(identifierInput) identifierInput.value = ''; if(identifierError) identifierError.textContent = ''; setTimeout(()=> identifierInput && identifierInput.focus(), 120); }, { passive: false });

  // close via explicit close buttons/backdrop
  closeBtns.forEach(b => on(b, 'click', (e)=>{ try{ e.preventDefault && e.preventDefault(); }catch(_){}; closeModal(); }, { passive:false }));

  if (backToEnter) on(backToEnter, 'click', (e)=>{ try{ e.preventDefault && e.preventDefault(); }catch(_){}; showStep('rs-step-enter'); }, { passive:false });

  /* identifier step */
  if (identifierNext) on(identifierNext, 'click', async (e) => {
    try {
      try { e.preventDefault && e.preventDefault(); } catch(_){}
      identifierError && (identifierError.textContent = '');
      const raw = (identifierInput && identifierInput.value || '').trim();
      if (!raw) { identifierError && (identifierError.textContent = 'Please enter your email or mobile number'); return; }

      // phone branch
      if (/^\d{10,}$/.test(raw)){
        try {
          const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
          if (error) { console.warn('phone lookup error', error); identifierError && (identifierError.textContent = 'Could not check phone right now'); return; }
          if (data && data.email) { knownEmailText && (knownEmailText.textContent = data.email); showStep('rs-step-password'); passwordInput && (passwordInput.value=''); return; }
          // new -> signup
          signupEmail && (signupEmail.value = ''); signupName && (signupName.value = ''); signupPassword && (signupPassword.value = ''); showStep('rs-step-signup'); signupEmail && signupEmail.focus(); return;
        } catch(err){ console.warn('phone check exception', err); identifierError && (identifierError.textContent = 'Unable to check right now'); return; }
      }

      // email branch — basic validation
      const email = raw;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { identifierError && (identifierError.textContent = 'Please enter a valid email address'); return; }

      identifierNext.disabled = true;
      const exists = await checkExistingByEmail(email);
      identifierNext.disabled = false;

      if (exists === true) { knownEmailText && (knownEmailText.textContent = email); showStep('rs-step-password'); passwordInput && (passwordInput.value=''); passwordError && (passwordError.textContent=''); }
      else if (exists === false) { signupEmail && (signupEmail.value = email); signupName && (signupName.value = ''); signupPassword && (signupPassword.value = ''); showStep('rs-step-signup'); signupPassword && signupPassword.focus(); }
      else { knownEmailText && (knownEmailText.textContent = email); showStep('rs-step-password'); passwordInput && (passwordInput.value=''); }
    } catch(err){ console.error('identifierNext handler error', err); identifierError && (identifierError.textContent = 'Unexpected error. Check console.'); }
  }, { passive:false });

  /* signin */
  if (signinBtn) on(signinBtn, 'click', async (e)=>{
    try {
      try{ e.preventDefault && e.preventDefault(); }catch(_){}
      passwordError && (passwordError.textContent='');
      const email = (knownEmailText && knownEmailText.textContent || '').trim();
      const pw = (passwordInput && passwordInput.value || '').trim();
      if (!email || !pw) { passwordError && (passwordError.textContent = 'Enter your password'); return; }
      signinBtn.disabled = true;
      const res = await signInWithPassword(email, pw);
      signinBtn.disabled = false;
      if (res.error) { console.warn('signIn error', res.error); passwordError && (passwordError.textContent = res.error.message || 'Sign in failed'); return; }

      // ensure session applied
      try {
        if (!res.error && res.data?.session) {
          await supabase.auth.setSession({ access_token: res.data.session.access_token, refresh_token: res.data.session.refresh_token });
        }
      } catch(e){ console.warn('setSession after sign-in failed', e); }

      closeModal();
      // refresh UI immediately
      try { window.__rs_refreshAuthUI && await window.__rs_refreshAuthUI(); } catch(e){}
      const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    } catch(err){ console.error('signin handler error', err); passwordError && (passwordError.textContent = 'Unexpected error. See console.'); try{ signinBtn.disabled = false; }catch(_){} }
  }, { passive:false });

  /* signup */
  if (signupBtn) on(signupBtn, 'click', async (e)=>{
    try {
      try{ e.preventDefault && e.preventDefault(); }catch(_){}
      signupError && (signupError.textContent='');
      const email = (signupEmail && signupEmail.value || '').trim();
      const name = (signupName && signupName.value || '').trim();
      const pw = (signupPassword && signupPassword.value || '').trim();
      if (!email || !name || !pw) { signupError && (signupError.textContent = 'Fill name, email and password'); return; }
      if (pw.length < 6) { signupError && (signupError.textContent = 'Password must be at least 6 characters'); return; }
      signupBtn.disabled = true;
      const res = await signUpWithEmail(email, pw, { full_name: name });
      signupBtn.disabled = false;
      if (res.error) { console.warn('signup error', res.error); signupError && (signupError.textContent = res.error.message || 'Signup failed'); return; }
      closeModal();
      try { window.__rs_refreshAuthUI && await window.__rs_refreshAuthUI(); } catch(e){}
      const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    } catch(err){ console.error('signup handler error', err); signupError && (signupError.textContent = 'Unexpected error. See console.'); try{ signupBtn.disabled = false; }catch(_){} }
  }, { passive:false });

  if (cancelSignup) on(cancelSignup, 'click', (e)=>{ try{ e.preventDefault && e.preventDefault(); }catch(_){}; showStep('rs-step-enter'); }, { passive:false });

  // close on ESC
  on(document, 'keydown', (e)=>{ if (e.key === 'Escape') closeModal(); }, { passive:true });
}

/* ---------- auth UI + logout ---------- */
export function renderHeaderExtras(){
  setCartCount(cartTotalCount());
  window.addEventListener('storage', ()=> setCartCount(cartTotalCount()));

  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  try {
    const toggle = document.getElementById('rs-header-login-toggle');
    const logout = document.getElementById('rs-logout-btn');

    const setUiLoggedIn = (loggedIn) => {
      if (toggle) toggle.style.display = loggedIn ? 'none' : '';
      if (logout) logout.style.display = loggedIn ? '' : 'none';
    };

    // refresh function exposed globally for use after sign in/signup
    window.__rs_refreshAuthUI = async function refreshAuthUI(){
      try {
        // prefer supabase client
        const userRes = await Promise.race([ supabase.auth.getUser(), new Promise((_, rej)=> setTimeout(()=> rej(new Error('getUser timeout')), 6000)) ]);
        const user = userRes && userRes.data && userRes.data.user ? userRes.data.user : (userRes && userRes.user) ? userRes.user : null;
        if (user) { setUiLoggedIn(true); return; }
      } catch(e){ console.warn('supabase.getUser failed/timeout, falling back', e); }

      // fallback: token check
      try {
        const storageKey = supabase.storageKey || Object.keys(localStorage).find(k => k.startsWith('sb-')) || 'sb-gugcnntetqarewwnzrki-auth-token';
        const raw = localStorage.getItem(storageKey);
        if (!raw) { setUiLoggedIn(false); return; }
        let parsed;
        try { parsed = JSON.parse(raw); } catch(e){ parsed = null; }
        const access_token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.value?.access_token;
        if (!access_token) { setUiLoggedIn(false); return; }
        const url = (supabase.supabaseUrl || '').replace(/\/$/,'') + '/auth/v1/user';
        const resp = await fetch(url, { method:'GET', headers: { 'Authorization': 'Bearer ' + access_token, 'apikey': supabase.supabaseKey }, mode: 'cors', cache: 'no-store' });
        if (resp.status === 200) setUiLoggedIn(true); else setUiLoggedIn(false);
      } catch(e){ console.warn('fallback token check failed', e); setUiLoggedIn(false); }
    };

    // attach auth state change
    try { supabase.auth.onAuthStateChange(()=> { window.__rs_refreshAuthUI && window.__rs_refreshAuthUI(); }); } catch(e){}

    // initial
    window.__rs_refreshAuthUI && window.__rs_refreshAuthUI();

    // logout handler
    if (logout) on(logout, 'click', async (e)=>{
      try { e.preventDefault && e.preventDefault(); } catch(_){}
      try { await supabase.auth.signOut().catch(()=>{}); } catch(e){}
      try {
        const storageKey = supabase.storageKey || Object.keys(localStorage).find(k => k.startsWith('sb-')) || 'sb-gugcnntetqarewwnzrki-auth-token';
        localStorage.removeItem(storageKey);
      } catch(e){}
      try { alert('You have been logged out.'); } catch(e){}
      window.location.href = '/';
    }, { passive:false });

  } catch(e){ console.warn('auth state wiring failed', e); }
}

/* auto-run */
try { renderHeaderExtras(); } catch(e){ console.warn('renderHeaderExtras error', e); }
