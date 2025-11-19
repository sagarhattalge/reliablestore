// assets/js/site_header.js
// Robust header + auth modal wiring for ReliableStore
import { supabase } from '/assets/js/supabase_client.js';

// small DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function safeShowStep(id){
  $$('.rs-step').forEach(el => {
    try { el.style.display = 'none'; } catch(e){}
  });
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

// robust open/close that uses inline styles (avoids CSS class conflicts)
function openModal(){
  const modal = $('#rs-auth-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modal.style.display = 'flex'; // ensure visible (override CSS)
  const backdrop = modal.querySelector('.rs-modal-backdrop');
  if (backdrop) backdrop.style.pointerEvents = 'auto';
  try { document.body.style.overflow = 'hidden'; } catch(e){}
  safeShowStep('rs-step-enter');
}

function closeModal(){
  const modal = $('#rs-auth-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  modal.style.display = 'none'; // ensure hidden (override CSS)
  const backdrop = modal.querySelector('.rs-modal-backdrop');
  if (backdrop) backdrop.style.pointerEvents = 'none';
  try { document.body.style.overflow = ''; } catch(e){}
}

// Cart helpers
function readCart(){
  try { return JSON.parse(localStorage.getItem('rs_cart_v1') || '{}'); } catch(e){ return {}; }
}
function cartTotalCount(){ const c = readCart(); return Object.values(c).reduce((s,i) => s + (i.qty||0), 0); }
function setCartCount(n){ const el = document.getElementById('cart-count'); if (el) el.textContent = String(n||0); }

// UI update for logged-in state
async function updateAuthUI(){
  try {
    const { data } = await supabase.auth.getUser();
    const loggedIn = !!data?.user;
    const toggle = $('#rs-header-login-toggle');
    const logoutBtn = $('#rs-logout-btn');
    if (toggle) toggle.style.display = loggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
    if (loggedIn) console.log('Supabase user:', data.user.email);
  } catch(e){
    console.warn('updateAuthUI error', e);
  }
}

// attach handlers (single-time)
function attachHandlers(){
  // header toggle
  const toggle = $('#rs-header-login-toggle');
  if (toggle) {
    toggle.addEventListener('click', (ev) => {
      ev.preventDefault && ev.preventDefault();
      openModal();
      setTimeout(() => { $('#rs-identifier')?.focus(); }, 80);
    }, {passive:false});
  }

  // logout
  const logoutBtn = $('#rs-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (ev) => {
      ev && ev.preventDefault && ev.preventDefault();
      try { await supabase.auth.signOut(); } catch(e){ console.warn('Sign out err', e); }
      alert('You have been logged out');
      window.location.href = '/';
    }, {passive:false});
  }

  // add robust close handlers in capture phase (so they run early)
  const modal = $('#rs-auth-modal');
  if (modal) {
    const closeEls = modal.querySelectorAll('.rs-modal-backdrop, .rs-modal-close, [data-rs-close]');
    closeEls.forEach(el => {
      // remove previous broken handlers best-effort
      try { el.onclick = null; } catch(e){}
      el.addEventListener('click', function(evt){
        try { evt.preventDefault(); evt.stopPropagation(); } catch(e){}
        closeModal();
      }, {capture:true, passive:false});
      el.addEventListener('touchstart', function(evt){
        try { evt.preventDefault(); evt.stopPropagation(); } catch(e){}
        closeModal();
      }, {capture:true, passive:false});
    });

    // as extra guard: if user clicks *outside* the panel body, close
    document.addEventListener('click', function(ev){
      try {
        if (modal.style.display === 'none' || modal.getAttribute('aria-hidden') === 'true') return;
        const panel = modal.querySelector('.rs-modal-panel');
        if (!panel) return;
        if (!panel.contains(ev.target)) closeModal();
      } catch(e){}
    }, {capture:true, passive:false});

    // escape key
    document.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape') closeModal();
    }, {capture:true, passive:false});
  }

  // Continue from identifier
  const identifierNext = $('#rs-identifier-next');
  if (identifierNext) {
    identifierNext.addEventListener('click', async (ev) => {
      ev && ev.preventDefault && ev.preventDefault();
      const raw = ($('#rs-identifier')?.value || '').trim();
      const errEl = $('#rs-identifier-error');
      if (!raw) { if (errEl) errEl.textContent = 'Please enter email or mobile'; return; }
      if (/^\d{10,}$/.test(raw)) {
        // phone lookup
        try {
          const { data, error } = await supabase.from('customers').select('id,email,phone').eq('phone', raw).limit(1).maybeSingle();
          if (error) console.warn('phone lookup err', error);
          if (data && data.email) $('#rs-known-email').textContent = data.email;
          else $('#rs-known-email').textContent = raw;
        } catch(e) { console.warn('phone lookup exception', e); $('#rs-known-email').textContent = raw; }
        safeShowStep('rs-step-password');
        $('#rs-password').value = '';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        if (errEl) errEl.textContent = 'Please enter a valid email address';
        return;
      }
      $('#rs-known-email').textContent = raw;
      $('#rs-password').value = '';
      safeShowStep('rs-step-password');
    }, {passive:false});
  }

  // back to enter
  $('#rs-back-to-enter')?.addEventListener('click', (ev) => { ev && ev.preventDefault && ev.preventDefault(); safeShowStep('rs-step-enter'); }, {passive:false});

  // go to signup
  $('#rs-go-signup')?.addEventListener('click', (ev) => {
    ev && ev.preventDefault && ev.preventDefault();
    $('#rs-signup-email').value = $('#rs-known-email').textContent || '';
    $('#rs-signup-name').value = '';
    $('#rs-signup-password').value = '';
    $('#rs-signup-error').textContent = '';
    safeShowStep('rs-step-signup');
  }, {passive:false});

  // signin
  $('#rs-signin-btn')?.addEventListener('click', async (ev) => {
    ev && ev.preventDefault && ev.preventDefault();
    $('#rs-password-error').textContent = '';
    const email = ($('#rs-known-email')?.textContent || '').trim();
    const pw = ($('#rs-password')?.value || '').trim();
    if (!email || !pw) { $('#rs-password-error').textContent = 'Enter your password'; return; }
    try {
      const res = await supabase.auth.signInWithPassword({ email, password: pw });
      if (res.error) {
        $('#rs-password-error').textContent = res.error.message || 'Sign in failed';
        console.warn('Sign in error', res.error);
        return;
      }
      closeModal();
      await updateAuthUI();
      alert('Signed in');
      window.location.reload();
    } catch(e){ console.error('signin exception', e); $('#rs-password-error').textContent = 'Sign in failed'; }
  }, {passive:false});

  // signup
  $('#rs-signup-btn')?.addEventListener('click', async (ev) => {
    ev && ev.preventDefault && ev.preventDefault();
    $('#rs-signup-error').textContent = '';
    const email = ($('#rs-signup-email')?.value || '').trim();
    const name = ($('#rs-signup-name')?.value || '').trim();
    const pw = ($('#rs-signup-password')?.value || '').trim();
    if (!email || !name || !pw) { $('#rs-signup-error').textContent = 'Fill name, email and password'; return; }
    if (pw.length < 6) { $('#rs-signup-error').textContent = 'Password must be at least 6 characters'; return; }
    try {
      const res = await supabase.auth.signUp({ email, password: pw, options: { data: { full_name: name } }});
      if (res.error) { $('#rs-signup-error').textContent = res.error.message || 'Signup failed'; console.warn('Signup err', res.error); return; }
      closeModal();
      alert('Account created. Check email to confirm if required.');
      await updateAuthUI();
      window.location.reload();
    } catch(e) { console.error('signup exception', e); $('#rs-signup-error').textContent = 'Signup failed'; }
  }, {passive:false});

  // cancel signup -> back
  $('#rs-cancel-signup')?.addEventListener('click', (ev) => { ev && ev.preventDefault && ev.preventDefault(); safeShowStep('rs-step-enter'); }, {passive:false});

  // initialize cart count and auth state
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));
  try { supabase.auth.onAuthStateChange(() => updateAuthUI()); } catch(e){}
  updateAuthUI();
}

// auto attach on DOM ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachHandlers);
else attachHandlers();

// helpful debug interface
window.rsHeader = {
  openModal, closeModal, updateAuthUI, setCartCount, cartTotalCount, readCart
};
