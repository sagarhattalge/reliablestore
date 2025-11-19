// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

/* ---------- modal auto-open guard ----------
   By default block any accidental auto-open on page load.
   Only open when user clicks Login (openModal({force:true})) or when code intentionally forces it.
*/
window.__rs_block_auto_modal = true;

/* ---------- helpers ---------- */
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

/* ---------- modal control (now guarded) ---------- */
/*
  openModal({force:true})  -> always opens
  openModal()             -> opens only if window.__rs_block_auto_modal !== true
*/
function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) {
    // blocked; do nothing
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

/* ---------- UI wiring and Supabase logic ---------- */
async function checkExistingByEmail(email){
  try {
    const { data, error } = await supabase.from('customers').select('id,email').eq('email', email).limit(1).maybeSingle();
    if (error) {
      console.warn('customers table check error:', error);
      return null;
    }
    return data ? true : false;
  } catch(err){
    console.warn('checkExistingByEmail exception', err);
    return null;
  }
}

async function signInWithPassword(email, password){
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  } catch(e){
    return { error: e };
  }
}

async function signUpWithEmail(email, password, metadata = {}){
  try {
    const res = await supabase.auth.signUp({ email, password, options: { data: metadata }});
    return res;
  } catch(e){
    return { error: e };
  }
}

/* ---------- attach modal handlers ---------- */
function setupAuthModal(){
  const toggle = document.getElementById('rs-header-login-toggle');
  const modal = document.getElementById('rs-auth-modal');
  if (!toggle || !modal) return;

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

  // open modal only when user clicks — use force:true so it bypasses the guard
  toggle.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch(_) {}
    // allow user-triggered open even if auto-block is enabled
    openModal({force:true});
    showStep('rs-step-enter');
    identifierInput && (identifierInput.value = '');
    identifierError && (identifierError.textContent = '');
    setTimeout(()=> identifierInput && identifierInput.focus(), 120);
  });

  // close modal from close buttons/backdrop
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch(_) {}
    closeModal();
  }));

  if (backToEnter) backToEnter.addEventListener('click', (e) => { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });

  /* identifier step (email or phone) */
  if (identifierNext) identifierNext.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch(_) {}
      identifierError.textContent = '';
      const raw = (identifierInput.value || '').trim();
      if (!raw) { identifierError.textContent = 'Please enter your email or mobile number'; return; }

      // phone branch
      if (/^\d{10,}$/.test(raw)) {
        try {
          const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
          if (error) { console.warn('phone lookup error', error); identifierError.textContent = 'Could not check phone right now'; return; }
          if (data && data.email) {
            knownEmailText.textContent = data.email;
            showStep('rs-step-password');
            passwordInput.value = '';
            return;
          } else {
            signupEmail && (signupEmail.value = '');
            signupName && (signupName.value = '');
            signupPassword && (signupPassword.value = '');
            showStep('rs-step-signup');
            signupEmail && signupEmail.focus();
            return;
          }
        } catch(err){
          console.warn('phone check exception', err);
          identifierError.textContent = 'Unable to check right now';
          return;
        }
      }

      // email branch
      const email = raw;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { identifierError.textContent = 'Please enter a valid email address'; return; }

      identifierNext.disabled = true;
      const exists = await checkExistingByEmail(email);
      identifierNext.disabled = false;

      if (exists === true) {
        knownEmailText.textContent = email;
        showStep('rs-step-password');
        passwordInput.value = '';
        passwordError.textContent = '';
      } else if (exists === false) {
        signupEmail && (signupEmail.value = email);
        signupName && (signupName.value = '');
        signupPassword && (signupPassword.value = '');
        showStep('rs-step-signup');
        signupPassword && signupPassword.focus();
      } else {
        knownEmailText.textContent = email;
        showStep('rs-step-password');
        passwordInput.value = '';
      }
    } catch(err) {
      console.error('identifierNext handler error', err);
      identifierError.textContent = 'Unexpected error. Check console.';
    }
  });

  /* signin button */
  if (signinBtn) signinBtn.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch(_) {}
      passwordError.textContent = '';
      const email = (knownEmailText.textContent || '').trim();
      const pw = (passwordInput.value || '').trim();
      if (!email || !pw) { passwordError.textContent = 'Enter your password'; return; }
      signinBtn.disabled = true;
      const res = await signInWithPassword(email, pw);
      signinBtn.disabled = false;
      if (res.error) {
        console.warn('signIn error', res.error);
        passwordError.textContent = res.error.message || 'Sign in failed';
        return;
      }
      // if server returned session, set it explicitly (best effort)
      try {
        if (!res.error && res.data?.session) {
          await supabase.auth.setSession({
            access_token: res.data.session.access_token,
            refresh_token: res.data.session.refresh_token
          });
        }
      } catch(e){ console.warn('setSession after sign-in failed', e); }

      closeModal();
      const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    } catch(err) {
      console.error('signin handler error', err);
      passwordError.textContent = 'Unexpected error. See console.';
      try { signinBtn.disabled = false; } catch(_) {}
    }
  });

  /* signup button */
  if (signupBtn) signupBtn.addEventListener('click', async (e) => {
    try {
      try { e.preventDefault(); } catch(_) {}
      signupError.textContent = '';
      const email = (signupEmail.value || '').trim();
      const name = (signupName.value || '').trim();
      const pw = (signupPassword.value || '').trim();
      if (!email || !name || !pw) { signupError.textContent = 'Fill name, email and password'; return; }
      if (pw.length < 6) { signupError.textContent = 'Password must be at least 6 characters'; return; }

      signupBtn.disabled = true;
      const res = await signUpWithEmail(email, pw, { full_name: name });
      signupBtn.disabled = false;
      if (res.error) {
        console.warn('signup error', res.error);
        signupError.textContent = res.error.message || 'Signup failed';
        return;
      }

      closeModal();
      const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    } catch(err) {
      console.error('signup handler error', err);
      signupError.textContent = 'Unexpected error. See console.';
      try { signupBtn.disabled = false; } catch(_) {}
    }
  });

  if (cancelSignup) cancelSignup.addEventListener('click', (e)=> { try { e.preventDefault(); } catch(_){}; showStep('rs-step-enter'); });

  // close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ---------- attach generic behavior (cart + initial wiring) ---------- */
export function renderHeaderExtras(){
  // update cart
  setCartCount(cartTotalCount());
  window.addEventListener('storage', ()=> setCartCount(cartTotalCount()));

  // wire modal & toggle
  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  // hide login when logged in (simple)
  try {
    const toggle = document.getElementById('rs-header-login-toggle');
    const logout = document.getElementById('rs-logout-btn');

    const setUiLoggedIn = (loggedIn) => {
      if (toggle) toggle.style.display = loggedIn ? 'none' : '';
      if (logout) {
        logout.style.display = loggedIn ? '' : 'none';
        logout.setAttribute('aria-hidden', loggedIn ? 'false' : 'true');
      }
    };

    // attempt to get user via supabase; but handle timeout/fallback
    async function refreshAuthUI(){
      try {
        // wait for getUser but with timeout
        const userRes = await Promise.race([
          supabase.auth.getUser(),
          new Promise((_, rej) => setTimeout(()=> rej(new Error('getUser timeout')), 6000))
        ]);
        const user = userRes && userRes.data && userRes.data.user ? userRes.data.user : (userRes && userRes.user) ? userRes.user : null;
        if (user) {
          setUiLoggedIn(true);
          return;
        }
      } catch(e){
        console.warn('supabase.getUser failed/timeout, falling back to token check', e);
      }

      // fallback: check stored Supabase token and /auth/v1/user
      try {
        const storageKey = supabase.storageKey || 'sb-gugcnntetqarewwnzrki-auth-token';
        const raw = localStorage.getItem(storageKey);
        if (!raw) { setUiLoggedIn(false); return; }
        let parsed;
        try { parsed = JSON.parse(raw); } catch(e){ parsed = null; }
        const access_token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.value?.access_token;
        if (!access_token) { setUiLoggedIn(false); return; }
        const url = supabase.supabaseUrl.replace(/\/$/,'') + '/auth/v1/user';
        const resp = await fetch(url, { method:'GET', headers: { 'Authorization': 'Bearer ' + access_token, 'apikey': supabase.supabaseKey }, mode: 'cors', cache: 'no-store' });
        if (resp.status === 200) {
          setUiLoggedIn(true);
        } else {
          setUiLoggedIn(false);
        }
      } catch(e){
        console.warn('fallback token check failed', e);
        setUiLoggedIn(false);
      }
    }

    // attach auth state change listener
    try {
      supabase.auth.onAuthStateChange(() => {
        refreshAuthUI().catch(e=>console.warn('refreshAuthUI error', e));
      });
    } catch(e){ /* ignore */ }

    // initial
    refreshAuthUI().catch(e=>console.warn('initial refreshAuthUI error', e));

    // attach logout click handler (safe)
    if (document.getElementById('rs-logout-btn')) {
      document.getElementById('rs-logout-btn').addEventListener('click', async (e) => {
        try { e.preventDefault && e.preventDefault(); } catch(e){}
        try {
          await supabase.auth.signOut().catch(()=>{});
        } catch(e){}
        // clear stored keys we used
        try {
          const storageKey = supabase.storageKey || 'sb-gugcnntetqarewwnzrki-auth-token';
          localStorage.removeItem(storageKey);
          Object.keys(localStorage).forEach(k => { if (/supabase|sb-|auth|session|token/.test(k)) localStorage.removeItem(k); });
        } catch(e){}
        try { alert('You have been logged out.'); } catch(e){}
        window.location.href = '/';
      });
    }

  } catch(e){ console.warn('auth state wiring failed', e); }
}

/* ---------- auto-run on import ---------- */
try { renderHeaderExtras(); } catch(e){ console.warn('renderHeaderExtras error', e); }
