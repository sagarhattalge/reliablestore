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

/* ---------- modal control helpers ---------- */
function openModal(){ const m=$('#rs-auth-modal'); if(!m) return; m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); }
function closeModal(){ const m=$('#rs-auth-modal'); if(!m) return; m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); }
function showStep(id){
  // hide all then show requested step - ensures only one visible
  $all('.rs-step').forEach(s=> s.classList.add('hidden'));
  const el = $('#'+id);
  if (el) el.classList.remove('hidden');
}

/* ---------- Supabase helpers ---------- */
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
  try { return await supabase.auth.signInWithPassword({ email, password }); } catch(e){ return { error: e }; }
}
async function signUpWithEmail(email, password, metadata = {}){
  try { return await supabase.auth.signUp({ email, password, options: { data: metadata }}); } catch(e){ return { error: e }; }
}

/* ---------- Auth UI updater (call this after sign-in/signup/logout) ---------- */
async function updateAuthUI(){
  try {
    const { data } = await supabase.auth.getUser();
    const loggedIn = !!data?.user;
    const toggle = document.getElementById('rs-header-login-toggle');
    const logoutBtn = document.getElementById('rs-logout-btn');
    if (toggle) toggle.classList.toggle('hidden', loggedIn);
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !loggedIn);
    // if logged in, optionally show user's email somewhere later
    return loggedIn;
  } catch(e){
    console.warn('updateAuthUI failed', e);
    return false;
  }
}

/* ---------- Core modal logic (non-capture handlers) ---------- */
function setupAuthModalInternal(){
  const closeBtns = $all('[data-rs-close]');
  const backToEnter = document.getElementById('rs-back-to-enter');
  const goSignup = document.getElementById('rs-go-signup');
  const cancelSignup = document.getElementById('rs-cancel-signup');

  // close/back buttons
  closeBtns.forEach(b => {
    b.removeEventListener('click', closeModal);
    b.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
  });

  if (backToEnter) {
    backToEnter.removeEventListener('click', () => {});
    backToEnter.addEventListener('click', (e) => { e.preventDefault(); showStep('rs-step-enter'); });
  }

  if (goSignup) {
    goSignup.removeEventListener('click', () => {});
    goSignup.addEventListener('click', (e) => {
      e.preventDefault();
      const known = (document.getElementById('rs-known-email') || {textContent:''}).textContent.trim();
      document.getElementById('rs-signup-email').value = known || '';
      document.getElementById('rs-signup-name').value = '';
      document.getElementById('rs-signup-password').value = '';
      showStep('rs-step-signup');
      try { document.getElementById('rs-signup-password').focus(); } catch(e){}
    });
  }

  if (cancelSignup) {
    cancelSignup.removeEventListener('click', () => {});
    cancelSignup.addEventListener('click', (e) => { e.preventDefault(); showStep('rs-step-enter'); });
  }

  // signin button
  const signinBtn = document.getElementById('rs-signin-btn');
  if (signinBtn) {
    signinBtn.removeEventListener('click', () => {});
    signinBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('rs-known-email').textContent || '').trim();
      const pw = (document.getElementById('rs-password').value || '').trim();
      const passwordError = document.getElementById('rs-password-error');
      passwordError.textContent = '';
      if (!email || !pw) { passwordError.textContent = 'Enter your password'; return; }

      signinBtn.disabled = true;
      const res = await signInWithPassword(email, pw);
      signinBtn.disabled = false;

      if (res.error) {
        console.warn('signIn error', res.error);
        passwordError.textContent = res.error.message || 'Sign in failed';
        return;
      }

      // success: update UI immediately and refresh page
      closeModal();
      await updateAuthUI();
      // show quick feedback then reload so page content (if any) updates
      try{ alert('Signed in successfully'); } catch(e){}
      setTimeout(()=> window.location.reload(), 300);
    });
  }

  // signup button
  const signupBtn = document.getElementById('rs-signup-btn');
  if (signupBtn) {
    signupBtn.removeEventListener('click', () => {});
    signupBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const signupEmail = (document.getElementById('rs-signup-email').value || '').trim();
      const signupName = (document.getElementById('rs-signup-name').value || '').trim();
      const signupPassword = (document.getElementById('rs-signup-password').value || '').trim();
      const signupError = document.getElementById('rs-signup-error');
      signupError.textContent = '';
      if (!signupEmail || !signupName || !signupPassword) { signupError.textContent = 'Fill name, email and password'; return; }
      if (signupPassword.length < 6) { signupError.textContent = 'Password must be at least 6 characters'; return; }

      signupBtn.disabled = true;
      const res = await signUpWithEmail(signupEmail, signupPassword, { full_name: signupName });
      signupBtn.disabled = false;

      if (res.error) {
        console.warn('signup error', res.error);
        signupError.textContent = res.error.message || 'Signup failed';
        return;
      }

      // If sign-up requires email confirmation, tell user
      closeModal();
      try { alert('Account created. Please check your email to confirm (if required).'); } catch(e){}
      await updateAuthUI();
      setTimeout(()=> window.location.reload(), 500);
    });
  }
}

/* ---------- Delegated, targeted handlers (safer than global capture) ---------- */
function setupDelegatedHandlers(){
  // Toggle (open modal)
  const toggle = document.getElementById('rs-header-login-toggle');
  if (toggle) {
    // remove prior listener (if any) then add a single non-passive handler
    try { toggle.replaceWith(toggle.cloneNode(true)); } catch(e){}
    const newToggle = document.getElementById('rs-header-login-toggle');
    if (newToggle) {
      newToggle.addEventListener('click', (e) => {
        e.preventDefault();
        showStep('rs-step-enter');
        const identifierInput = document.getElementById('rs-identifier');
        if (identifierInput) identifierInput.value = '';
        openModal();
        try { setTimeout(()=> identifierInput && identifierInput.focus(), 120); } catch(e){}
      });
    }
  }

  // Identifier Continue button
  const idNext = document.getElementById('rs-identifier-next');
  if (idNext) {
    try { idNext.replaceWith(idNext.cloneNode(true)); } catch(e){}
    const newIdNext = document.getElementById('rs-identifier-next');
    if (newIdNext) {
      newIdNext.addEventListener('click', async (e) => {
        e.preventDefault();
        const identifierInput = document.getElementById('rs-identifier');
        const identifierError = document.getElementById('rs-identifier-error');
        const knownEmailText = document.getElementById('rs-known-email');
        const passwordInput = document.getElementById('rs-password');
        if (!identifierInput) return;
        identifierError.textContent = '';
        const raw = (identifierInput.value || '').trim();
        if (!raw) { identifierError.textContent = 'Please enter your email or mobile number'; return; }

        // phone case
        if (/^\d{10,}$/.test(raw)) {
          try {
            const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
            if (error) { console.warn('phone lookup error', error); identifierError.textContent = 'Could not check phone right now'; return; }
            if (data && data.email) knownEmailText.textContent = data.email;
            else knownEmailText.textContent = raw;
            showStep('rs-step-password'); passwordInput.value = ''; return;
          } catch(err) {
            console.warn('phone check exception', err); identifierError.textContent = 'Unable to check right now'; return;
          }
        }

        // email case
        const email = raw;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { identifierError.textContent = 'Please enter a valid email address'; return; }

        try {
          const exists = await checkExistingByEmail(email);
          (document.getElementById('rs-known-email') || {textContent:''}).textContent = email;
          showStep('rs-step-password');
          (document.getElementById('rs-password') || {value:''}).value = '';
        } catch(err) {
          console.warn('identifier processing error', err);
          identifierError.textContent = 'Unable to continue right now';
        }
      });
    }
  }

  // Backdrop / close buttons (delegate each; they already wired in setupAuthModalInternal but ensure a listener exists)
  $all('[data-rs-close]').forEach(btn => {
    // avoid duplicate by cloning if there's any doubt
    try { btn.replaceWith(btn.cloneNode(true)); } catch(e){}
    const fresh = document.querySelector(`[data-rs-close]`);
    if (fresh) fresh.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
  });
}

/* ---------- Auth state UI and logout ---------- */
function setupAuthStateUI(){
  const logoutBtn = document.getElementById('rs-logout-btn');

  async function update() { await updateAuthUI(); }

  // sign out handler
  if (logoutBtn) {
    logoutBtn.removeEventListener('click', () => {});
    logoutBtn.addEventListener('click', async () => {
      try { await supabase.auth.signOut(); } catch (e) { console.warn('signOut error', e); }
      try { alert('You have been logged out.'); } catch(e){}
      window.location.href = '/';
    });
  }

  try { supabase.auth.onAuthStateChange(() => update()); } catch(e) { console.warn('onAuthStateChange not available', e); }
  update();
}

/* ---------- Initialization ---------- */
export function renderHeaderExtras(){
  // cart count
  setCartCount(cartTotalCount());
  window.addEventListener('storage', ()=> setCartCount(cartTotalCount()));

  // core wiring
  try { setupAuthModalInternal(); } catch(e){ console.warn('setupAuthModalInternal error', e); }
  try { setupCaptureInterceptor(); } catch(e){ console.warn('setupCaptureInterceptor error', e); }
  try { setupAuthStateUI(); } catch(e){ console.warn('setupAuthStateUI error', e); }
}

/* Auto-run */
try { setupDelegatedHandlers(); } catch(e){ console.warn('setupDelegatedHandlers error', e); }
