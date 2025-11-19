// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

// Short helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const show = (id) => {
  $$('.rs-step').forEach(e => e.style.display = 'none');
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
};
const openModal = () => {
  const m = $('#rs-auth-modal');
  if (!m) return;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  // ensure the first step is visible
  show('rs-step-enter');
};
const closeModal = () => {
  const m = $('#rs-auth-modal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
};

// Cart helpers (simple)
function readCart(){
  try { return JSON.parse(localStorage.getItem('rs_cart_v1') || '{}'); } catch(e) { return {}; }
}
function cartTotalCount(){ const c = readCart(); return Object.values(c).reduce((s,i) => s + (i.qty||0), 0); }
function setCartCount(n){ const el = document.getElementById('cart-count'); if (el) el.textContent = String(n||0); }

// Update header UI based on auth
async function updateAuthUI(){
  try {
    const { data } = await supabase.auth.getUser();
    const loggedIn = !!data?.user;
    const toggle = $('#rs-header-login-toggle');
    const logoutBtn = $('#rs-logout-btn');
    if (toggle) toggle.style.display = loggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
    // optionally show email in console for debug
    if (loggedIn) console.log('Logged in as', data.user.email);
  } catch (e) {
    console.warn('updateAuthUI error', e);
  }
}

// Attach handlers to modal + header (single-time wiring)
function attachHandlers(){
  // header buttons
  const toggle = $('#rs-header-login-toggle');
  if (toggle) toggle.addEventListener('click', (e) => { e.preventDefault(); openModal(); setTimeout(()=> { $('#rs-identifier')?.focus(); }, 80); });

  const logoutBtn = $('#rs-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    try { await supabase.auth.signOut(); } catch(e){ console.warn('signOut err', e); }
    alert('You have been logged out.');
    window.location.href = '/';
  });

  // modal close & backdrop
  $$('.rs-modal-backdrop, .rs-modal-close, [data-rs-close]').forEach(el => {
    el.addEventListener('click', (ev) => { ev.preventDefault(); closeModal(); });
  });

  // identifier continue
  const identifierNext = $('#rs-identifier-next');
  identifierNext?.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const raw = ($('#rs-identifier')?.value || '').trim();
    const errEl = $('#rs-identifier-error');
    if (!raw) return errEl && (errEl.textContent = 'Please enter email or mobile');
    errEl && (errEl.textContent = '');
    // phone?
    if (/^\d{10,}$/.test(raw)) {
      try {
        const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
        if (error) { console.warn('phone lookup', error); }
        if (data && data.email) $('#rs-known-email').textContent = data.email;
        else $('#rs-known-email').textContent = raw;
      } catch(e) { console.warn('phone check err', e); $('#rs-known-email').textContent = raw; }
      show('rs-step-password');
      $('#rs-password').value = '';
      return;
    }
    // email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return errEl && (errEl.textContent = 'Please enter a valid email address');
    }
    // show password step and prefill email
    $('#rs-known-email').textContent = raw;
    $('#rs-password').value = '';
    show('rs-step-password');
  });

  // back to enter
  $('#rs-back-to-enter')?.addEventListener('click', (e) => { e.preventDefault(); show('rs-step-enter'); });

  // go signup from password step
  $('#rs-go-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#rs-signup-email').value = $('#rs-known-email').textContent || '';
    $('#rs-signup-name').value = '';
    $('#rs-signup-password').value = '';
    $('#rs-signup-error').textContent = '';
    show('rs-step-signup');
  });

  // signin
  $('#rs-signin-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = ($('#rs-known-email')?.textContent || '').trim();
    const pw = ($('#rs-password')?.value || '').trim();
    $('#rs-password-error').textContent = '';
    if (!email || !pw) { $('#rs-password-error').textContent = 'Enter your password'; return; }
    try {
      const res = await supabase.auth.signInWithPassword({ email, password: pw });
      if (res.error) {
        console.warn('signin err', res.error);
        $('#rs-password-error').textContent = res.error.message || 'Sign in failed';
        return;
      }
      // success
      closeModal();
      await updateAuthUI();
      alert('Signed in successfully');
      window.location.reload();
    } catch (err) {
      console.error('signin exception', err);
      $('#rs-password-error').textContent = 'Sign in failed';
    }
  });

  // signup
  $('#rs-signup-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    $('#rs-signup-error').textContent = '';
    const email = ($('#rs-signup-email')?.value || '').trim();
    const name = ($('#rs-signup-name')?.value || '').trim();
    const pw = ($('#rs-signup-password')?.value || '').trim();
    if (!email || !name || !pw) { $('#rs-signup-error').textContent = 'Fill name, email and password'; return; }
    if (pw.length < 6) { $('#rs-signup-error').textContent = 'Password must be at least 6 characters'; return; }
    try {
      const res = await supabase.auth.signUp({ email, password: pw, options: { data: { full_name: name } }});
      if (res.error) {
        console.warn('signup err', res.error);
        $('#rs-signup-error').textContent = res.error.message || 'Signup failed';
        return;
      }
      closeModal();
      alert('Account created. Check your email to confirm if required.');
      await updateAuthUI();
      window.location.reload();
    } catch (err) {
      console.error('signup exception', err);
      $('#rs-signup-error').textContent = 'Signup failed';
    }
  });

  // cancel signup
  $('#rs-cancel-signup')?.addEventListener('click', (e) => { e.preventDefault(); show('rs-step-enter'); });

  // keyboard Esc to close
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Update cart count
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  // auth state changes
  try { supabase.auth.onAuthStateChange(() => updateAuthUI()); } catch(e) { /* ignore */ }
  updateAuthUI();
}

// Auto-run attach on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachHandlers);
} else {
  attachHandlers();
}
