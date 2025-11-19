// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

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

/* ---------- modal control ---------- */
function openModal(){ const m=$('#rs-auth-modal'); if(!m) return; m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); }
function closeModal(){ const m=$('#rs-auth-modal'); if(!m) return; m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); }
function showStep(id){ $all('.rs-step').forEach(s=> s.classList.add('hidden')); const el = $('#'+id); if(el) el.classList.remove('hidden'); }

/* ---------- UI wiring and Supabase logic ---------- */
async function checkExistingByEmail(email){
  // Attempt to find user in customers table first (simple and fast)
  try {
    const { data, error } = await supabase.from('customers').select('id,email').eq('email', email).limit(1).maybeSingle();
    if (error) {
      // if customers table not accessible, fall back to trying to sign-in (we will rely on signIn errors)
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
  // elements
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

  // open modal
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    showStep('rs-step-enter');
    identifierInput.value = '';
    identifierError.textContent = '';
    openModal();
    setTimeout(()=> identifierInput.focus(), 120);
  }, { passive: true });

  // close modal from close buttons/backdrop
  closeBtns.forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  }));

  // back to enter
  if (backToEnter) backToEnter.addEventListener('click', (e) => { e.preventDefault(); showStep('rs-step-enter'); });

  // identifier step (email or phone)
  identifierNext.addEventListener('click', async (e) => {
    e.preventDefault();
    identifierError.textContent = '';
    const raw = (identifierInput.value || '').trim();
    if (!raw) { identifierError.textContent = 'Please enter your email or mobile number'; return; }

    // quick normalization: if looks like phone (digits only) convert to a placeholder email-like string? 
    // (Better to require email to simplify logic; but we accept both — if phone is used, you must have stored phone in customers)
    let email = raw;
    if (/^\d{10,}$/.test(raw)) {
      // phone entered; attempt to find by phone in customers table
      try {
        const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
        if (error) { console.warn('phone lookup error', error); identifierError.textContent = 'Could not check phone right now'; return; }
        if (data && data.email) {
          // treat as existing account
          knownEmailText.textContent = data.email;
          showStep('rs-step-password');
          passwordInput.value = '';
          return;
        } else {
          // no record; open signup step with phone prefilled
          signupEmail.value = '';
          signupName.value = '';
          signupPassword.value = '';
          // store phone in name field or metadata if you wish
          showStep('rs-step-signup');
          signupEmail.focus();
          return;
        }
      } catch(err) {
        console.warn('phone check exception', err);
        identifierError.textContent = 'Unable to check right now';
        return;
      }
    }

    // treat as email
    // minimal email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { identifierError.textContent = 'Please enter a valid email address'; return; }

    // Check customers table for existing email
    identifierNext.disabled = true;
    const exists = await checkExistingByEmail(email);
    identifierNext.disabled = false;

    if (exists === true) {
      // existing -> show password view, display email
      knownEmailText.textContent = email;
      showStep('rs-step-password');
      passwordInput.value = '';
      passwordError.textContent = '';
    } else if (exists === false) {
      // new user -> show signup form and prefill email
      signupEmail.value = email;
      signupName.value = '';
      signupPassword.value = '';
      showStep('rs-step-signup');
      signupPassword.focus();
    } else {
      // unknown (customers table not accessible) -> we fallback to prompt password first
      knownEmailText.textContent = email;
      showStep('rs-step-password');
      passwordInput.value = '';
    }
  }, { passive: true });

  // signin button
  signinBtn.addEventListener('click', async (e) => {
    e.preventDefault();
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
    // success: redirect to returnTo
    closeModal();
    const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
    window.location.href = decodeURIComponent(rt || '/');
  }, { passive: true });

  // signup button
  signupBtn.addEventListener('click', async (e) => {
    e.preventDefault();
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

    // Signed up successfully — depending on your Supabase email confirmation setting, either user is created or needs confirmation
    closeModal();
    // If email confirm required, show info (we keep it simple and redirect to home or returnTo)
    const rt = new URLSearchParams(window.location.search).get('returnTo') || returnToEncoded();
    window.location.href = decodeURIComponent(rt || '/');
  }, { passive: true });

  // cancel signup/back
  if (cancelSignup) cancelSignup.addEventListener('click', (e)=> { e.preventDefault(); showStep('rs-step-enter'); });

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
    supabase.auth.onAuthStateChange(() => {
      supabase.auth.getUser().then(({data}) => {
        const loggedIn = !!data?.user;
        const toggle = document.getElementById('rs-header-login-toggle');
        if (toggle) toggle.classList.toggle('hidden', loggedIn);
      });
    });
    // initial set
    supabase.auth.getUser().then(({data}) => {
      const loggedIn = !!data?.user;
      const toggle = document.getElementById('rs-header-login-toggle');
      if (toggle) toggle.classList.toggle('hidden', loggedIn);
    });
  } catch(e) { console.warn('auth state wiring failed', e); }
}

/* ---------- auto-run on import ---------- */
try { renderHeaderExtras(); } catch(e){ console.warn('renderHeaderExtras error', e); }

/* ---------- helper functions for Supabase calls ---------- */
async function checkExistingByEmail(email){
  // same as above: wrapper for exported function (dup allowed)
  try {
    const { data, error } = await supabase.from('customers').select('id,email').eq('email', email).limit(1).maybeSingle();
    if (error) { console.warn('customers table check error', error); return null; }
    return data ? true : false;
  } catch(err){ console.warn('checkExistingByEmail exception', err); return null; }
}
async function signInWithPassword(email, password){
  try { return await supabase.auth.signInWithPassword({ email, password }); } catch(e){ return { error: e }; }
}
async function signUpWithEmail(email, password, metadata={}){ 
  try { return await supabase.auth.signUp({ email, password, options: { data: metadata } }); } catch(e){ return { error: e }; }
}
