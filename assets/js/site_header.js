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
/* Note: we avoid relying solely on customers table existence.
   We will show password prompt when uncertain, and allow switching to signup. */
async function checkExistingByEmail(email){
  try {
    const { data, error } = await supabase.from('customers').select('id,email').eq('email', email).limit(1).maybeSingle();
    if (error) { console.warn('customers table check error:', error); return null; }
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
  const goSignup = document.getElementById('rs-go-signup');

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

  // identifier step (email or phone) - we will prefer password flow first to match auth users
  identifierNext.addEventListener('click', async (e) => {
    e.preventDefault();
    identifierError.textContent = '';
    const raw = (identifierInput.value || '').trim();
    if (!raw) { identifierError.textContent = 'Please enter your email or mobile number'; return; }

    // If user enters phone digits -> attempt phone lookup (customers table). If found, go to password for that email.
    if (/^\d{10,}$/.test(raw)) {
      try {
        const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
        if (error) { console.warn('phone lookup error', error); identifierError.textContent = 'Could not check phone right now'; return; }
        if (data && data.email) {
          knownEmailText.textContent = data.email;
        } else {
          // Unknown phone - still show password prompt but prefill knownEmailText with the phone (will attempt login via email won't work)
          knownEmailText.textContent = raw;
        }
        showStep('rs-step-password');
        passwordInput.value = '';
        return;
      } catch(err) {
        console.warn('phone check exception', err);
        identifierError.textContent = 'Unable to check right now';
        return;
      }
    }

    // treat as email
    const email = raw;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { identifierError.textContent = 'Please enter a valid email address'; return; }

    // try to detect existence in customers table — but regardless of result we show password prompt first (safer)
    identifierNext.disabled = true;
    const exists = await checkExistingByEmail(email);
    identifierNext.disabled = false;

    // show password step and prefill the email for user to enter password.
    knownEmailText.textContent = email;
    showStep('rs-step-password');
    passwordInput.value = '';
    passwordError.textContent = '';

    // If customers table returned true, that's confirmation; if false or null we still show password to let auth handle it.
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

  // "Create account" from password step - opens signup step with email prefilled
  if (goSignup) {
    goSignup.addEventListener('click', (e) => {
      e.preventDefault();
      signupEmail.value = (knownEmailText.textContent || '').trim();
      signupName.value = '';
      signupPassword.value = '';
      showStep('rs-step-signup');
      signupPassword.focus();
    });
  }

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

    // Signed up successfully
    closeModal();
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

/* ---------- attach generic behavior (cart + auth state + logout) ---------- */
function setupAuthStateUI(){
  const toggle = document.getElementById('rs-header-login-toggle');
  const logoutBtn = document.getElementById('rs-logout-btn');

  async function update() {
    try {
      const { data } = await supabase.auth.getUser();
      const loggedIn = !!data?.user;
      if (toggle) toggle.classList.toggle('hidden', loggedIn);
      if (logoutBtn) logoutBtn.classList.toggle('hidden', !loggedIn);
    } catch(e) {
      console.warn('auth getUser failed', e);
    }
  }

  // sign out handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('signOut error', e);
      }
      // show logout info then go home
      try { alert('You have been logged out.'); } catch(e){}
      window.location.href = '/';
    });
  }

  // listen to auth changes
  try {
    supabase.auth.onAuthStateChange(() => update());
  } catch(e) {
    console.warn('onAuthStateChange not available', e);
  }
  // initial
  update();
}

/* ---------- attach generic behavior (cart + initial wiring) ---------- */
export function renderHeaderExtras(){
  // update cart
  setCartCount(cartTotalCount());
  window.addEventListener('storage', ()=> setCartCount(cartTotalCount()));

  // wire modal & toggle
  try { setupAuthModal(); } catch (e) { console.warn('setupAuthModal error', e); }

  // wire auth state and logout
  try { setupAuthStateUI(); } catch (e) { console.warn('setupAuthStateUI error', e); }
}

/* ---------- auto-run on import ---------- */
try { renderHeaderExtras(); } catch(e){ console.warn('renderHeaderExtras error', e); }
