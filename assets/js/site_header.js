// assets/js/site_header.js
import { supabase } from '/assets/js/supabase_client.js';

/*
  Header injector + robust behavior:
  - Injects compact header DOM (if you want to use this instead of _includes, but we keep _includes as source)
  - Wires cart count using localStorage rs_cart_v1
  - Wires toggle button data-rs-toggle-login-signup (Option B)
  - Intercepts old anchors to /account.html (back-compat)
  - Safely handles missing elements and supabase errors
*/

const siteHeaderHtml = `
  <style>
    .rs-header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:white;border-bottom:1px solid #eee;position:sticky;top:0;z-index:60}
    .rs-left{display:flex;align-items:center;gap:14px}
    .rs-logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit}
    .rs-logo img{height:36px}
    .rs-nav{display:flex;gap:10px;align-items:center}
    .rs-btn{background:#FE9900;color:#fff;padding:8px 12px;border-radius:8px;border:0;cursor:pointer}
    .rs-link{background:#fff;border:1px solid #ddd;padding:7px 10px;border-radius:8px;cursor:pointer}
    .btn-link{background:transparent;border:none;color:inherit;cursor:pointer;padding:6px 8px}
    .hidden{display:none!important}
    @media (max-width:640px){ .rs-nav{gap:6px} }
  </style>
`;

/* Helper to compute returnTo param */
function getReturnTo() {
  return window.location.pathname + window.location.search + window.location.hash;
}

/* Cart helpers: support both #cart-count and #cart_count */
function setCartCount(n) {
  const el1 = document.getElementById('cart-count');
  const el2 = document.getElementById('cart_count');
  if (el1) el1.innerText = String(n || 0);
  if (el2) el2.innerText = String(n || 0);
}

function readCart() {
  try {
    const raw = localStorage.getItem('rs_cart_v1');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function cartTotalCount() {
  const cart = readCart();
  return Object.values(cart).reduce((s, p) => s + (p?.qty || 0), 0);
}

function returnToEncoded() {
  return encodeURIComponent(getReturnTo() || '/');
}

function attachRedirect(el, destPage) {
  if (!el || el.dataset?.rsWired) return;
  el.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/' + destPage + '.html?returnTo=' + returnToEncoded();
  }, { passive: true });
  el.dataset.rsWired = '1';
}

function attachToggleBehavior(el) {
  if (!el || el.dataset?.rsWired) return;
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const txt = (el.textContent || el.innerText || '').toLowerCase();
    const r = returnToEncoded();
    if (/sign|register/.test(txt)) {
      window.location.href = '/signup.html?returnTo=' + r;
    } else {
      window.location.href = '/login.html?returnTo=' + r;
    }
  }, { passive: true });
  el.dataset.rsWired = '1';
}

/* Replace anchors pointing to /account.html with correct behavior (back-compat) */
function interceptAccountAnchors() {
  try {
    const anchors = Array.from(document.querySelectorAll('a[href*="account"]'));
    anchors.forEach(a => {
      if (a.dataset?.rsWired) return;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const txt = (a.textContent || a.innerText || '').toLowerCase();
        const r = returnToEncoded();
        if (/sign|register/.test(txt)) window.location.href = '/signup.html?returnTo=' + r;
        else window.location.href = '/login.html?returnTo=' + r;
      }, { passive: true });
      a.dataset.rsWired = '1';
    });
  } catch (err) {
    // ignore
  }
}

/* Find toggle buttons (our data attribute or legacy classes) */
function findToggleElements() {
  const nodes = Array.from(document.querySelectorAll('[data-rs-toggle-login-signup], .login-link, button.login-link, a.login-link'));
  return nodes;
}

/* Robust wiring function (idempotent) */
function robustWire() {
  // Attach to any data-rs-toggle elements
  findToggleElements().forEach(attachToggleBehavior);

  // Also attach if someone added explicit IDs (btn_login / btn_signup) elsewhere
  attachRedirect(document.getElementById('btn_login'), 'login');
  attachRedirect(document.getElementById('btn_signup'), 'signup');

  // Attach fallback on links to account.html
  interceptAccountAnchors();
}

/* Public renderHeader — safe, non-destructive */
export function renderHeader() {
  // If _includes/header.html is used, do not inject duplicate header DOM.
  // But if there is no header in DOM we optionally inject minimal CSS only (so code runs)
  if (!document.querySelector('header.site-topbar')) {
    // For pages that don't include the Jekyll header, inject very small styling container
    if (!document.getElementById('rs_header_style')) {
      const styleWrap = document.createElement('div');
      styleWrap.id = 'rs_header_style';
      styleWrap.innerHTML = siteHeaderHtml;
      document.head.appendChild(styleWrap);
    }
  }

  // hide fallback header if present
  if (window.hideFallbackHeader) {
    try { window.hideFallbackHeader(); } catch (e) { /* ignore */ }
  }

  // initial cart count wiring (reads localStorage)
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () => setCartCount(cartTotalCount()));

  // auth UI updates (when Supabase is available)
  async function updateAuthUI() {
    try {
      const { data } = await supabase.auth.getUser();
      const loggedIn = !!data?.user;
      // Hide toggle controls when logged in
      const toggles = findToggleElements();
      toggles.forEach(t => t.classList.toggle('hidden', loggedIn));
      // If there are explicit btn_logout in an injected header, show it
      const lb = document.getElementById('btn_logout');
      if (lb) lb.classList.toggle('hidden', !loggedIn);
    } catch (err) {
      console.warn('updateAuthUI error', err);
    }
  }
  try { supabase.auth.onAuthStateChange(() => updateAuthUI()); } catch(e) { /* ignore */ }
  updateAuthUI();

  // Attach handlers now and when DOM changes (header might be injected by Jekyll include)
  robustWire();
  const mo = new MutationObserver(() => robustWire());
  mo.observe(document.body, { childList: true, subtree: true });
}

/* Auto-execute (safe) */
try { renderHeader(); } catch (e) { console.warn('renderHeader error', e); }
