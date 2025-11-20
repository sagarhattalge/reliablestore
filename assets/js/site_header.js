/* assets/js/site_header.js  */
/* FINAL PATCHED VERSION – MODAL WILL NOT AUTO-OPEN ANYWHERE */

import { supabase } from '/assets/js/supabase_client.js';

/* -----------------------------------------------------------
   HARD-PREVENT any accidental modal auto-open on any page
   This runs BEFORE any other code and guarantees the modal
   is hidden on initial page load.
------------------------------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  const m = document.getElementById("rs-auth-modal");
  if (m) {
    m.classList.add("hidden");
    m.setAttribute("aria-hidden", "true");
  }
});

window.__rs_block_auto_modal = true;

/* -------------------- small helpers -------------------- */
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const getReturnTo = () =>
  window.location.pathname +
  window.location.search +
  window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || '/');

function readCart() {
  try {
    return JSON.parse(localStorage.getItem('rs_cart_v1') || '{}');
  } catch (e) {
    return {};
  }
}
function cartTotalCount() {
  const c = readCart();
  return Object.values(c).reduce((s, i) => s + (i.qty || 0), 0);
}
function setCartCount(n) {
  const el1 = document.getElementById('cart-count');
  const el2 = document.getElementById('cart_count');
  if (el1) el1.innerText = String(n || 0);
  if (el2) el2.innerText = String(n || 0);
}

/* -------------------- modal accessibility helpers -------------------- */
function _disablePageForModal() {
  const main = document.querySelector('main') || document.body;
  try {
    main.inert = true;
  } catch (e) {
    main.setAttribute('aria-hidden', 'true');
  }
}
function _restorePageAfterModal() {
  const main = document.querySelector('main') || document.body;
  try {
    main.inert = false;
  } catch (e) {
    main.removeAttribute('aria-hidden');
  }
}

/* -------------------- modal open/close -------------------- */
function openModal(opts = {}) {
  const force = !!opts.force;
  if (!force && window.__rs_block_auto_modal) {
    console.debug('rs-auth-modal open blocked');
    return;
  }
  const m = $('#rs-auth-modal');
  if (!m) return;

  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');

  _disablePageForModal();

  setTimeout(() => {
    const input = m.querySelector(
      'input, button, [tabindex]:not([tabindex="-1"])'
    );
    if (input) {
      try {
        input.focus();
      } catch (e) {}
    }
  }, 80);
}

function closeModal() {
  const m = $('#rs-auth-modal');
  if (!m) return;

  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  _restorePageAfterModal();

  const toggle =
    document.getElementById('rs-header-login-toggle') ||
    document.getElementById('btn_login');
  if (toggle) try { toggle.focus(); } catch (e) {}
}

function showStep(id) {
  $all('.rs-step').forEach((s) => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

/* -------------------- Supabase helpers -------------------- */
async function checkExistingByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id,email')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data ? true : false;
  } catch (err) {
    return null;
  }
}

async function signInWithPassword(email, password) {
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  } catch (e) {
    return { error: e };
  }
}

async function signUpWithEmail(email, password, metadata = {}) {
  try {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return res;
  } catch (e) {
    return { error: e };
  }
}

/* -------------------- modal wiring -------------------- */
function setupAuthModal() {
  const toggle =
    document.getElementById('rs-header-login-toggle') ||
    document.getElementById('btn_login');
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

  /* --- open modal --- */
  toggle.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch (_) {}
    openModal({ force: true });
    showStep('rs-step-enter');
    identifierInput && (identifierInput.value = '');
    identifierError && (identifierError.textContent = '');
    setTimeout(() => identifierInput?.focus(), 120);
  });

  /* --- close modal --- */
  closeBtns.forEach((b) =>
    b.addEventListener('click', (e) => {
      try { e.preventDefault(); } catch (_) {}
      closeModal();
    })
  );

  document.addEventListener('click', (ev) => {
    const m = document.getElementById('rs-auth-modal');
    if (!m || m.classList.contains('hidden')) return;
    const panel = m.querySelector('.rs-modal-panel');
    if (panel && !panel.contains(ev.target)) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  backToEnter &&
    backToEnter.addEventListener('click', (e) => {
      try { e.preventDefault(); } catch (_) {}
      showStep('rs-step-enter');
    });

  /* --- identifier -> email/phone logic --- */
  identifierNext &&
    identifierNext.addEventListener('click', async (e) => {
      try {
        e.preventDefault && e.preventDefault();
        identifierError.textContent = '';
        const raw = (identifierInput?.value || '').trim();
        if (!raw) {
          identifierError.textContent =
            'Please enter your email or mobile number';
          return;
        }

        /* phone */
        if (/^\d{10,}$/.test(raw)) {
          try {
            const { data } = await supabase
              .from('customers')
              .select('id,email,phone')
              .eq('phone', raw)
              .limit(1)
              .maybeSingle();

            if (data?.email) {
              knownEmailText.textContent = data.email;
              showStep('rs-step-password');
              passwordInput.value = '';
            } else {
              signupEmail.value = '';
              signupName.value = '';
              signupPassword.value = '';
              showStep('rs-step-signup');
              signupEmail.focus();
            }
            return;
          } catch (err) {
            identifierError.textContent = 'Unable to check right now';
            return;
          }
        }

        /* email */
        const email = raw;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          identifierError.textContent = 'Please enter a valid email address';
          return;
        }

        identifierNext.disabled = true;
        const exists = await checkExistingByEmail(email);
        identifierNext.disabled = false;

        if (exists === true) {
          knownEmailText.textContent = email;
          showStep('rs-step-password');
          passwordInput.value = '';
          passwordError.textContent = '';
        } else if (exists === false) {
          signupEmail.value = email;
          signupName.value = '';
          signupPassword.value = '';
          showStep('rs-step-signup');
          signupPassword.focus();
        } else {
          knownEmailText.textContent = email;
          showStep('rs-step-password');
          passwordInput.value = '';
        }
      } catch (err) {
        identifierError.textContent = 'Unexpected error';
      }
    });

  /* --- Sign in --- */
  signinBtn &&
    signinBtn.addEventListener('click', async (e) => {
      e.preventDefault && e.preventDefault();
      passwordError.textContent = '';

      const email = knownEmailText.textContent.trim();
      const pw = passwordInput.value.trim();
      if (!email || !pw) {
        passwordError.textContent = 'Enter your password';
        return;
      }

      signinBtn.disabled = true;
      const res = await signInWithPassword(email, pw);
      signinBtn.disabled = false;

      if (res.error) {
        passwordError.textContent = res.error.message || 'Sign in failed';
        return;
      }

      try {
        if (res.data?.session) {
          await supabase.auth.setSession({
            access_token: res.data.session.access_token,
            refresh_token: res.data.session.refresh_token,
          });
        }
      } catch (_) {}

      closeModal();
      const rt =
        new URLSearchParams(window.location.search).get('returnTo') ||
        returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    });

  /* --- Sign up --- */
  signupBtn &&
    signupBtn.addEventListener('click', async (e) => {
      e.preventDefault && e.preventDefault();
      signupError.textContent = '';

      const email = signupEmail.value.trim();
      const name = signupName.value.trim();
      const pw = signupPassword.value.trim();

      if (!email || !name || !pw) {
        signupError.textContent = 'Fill name, email and password';
        return;
      }
      if (pw.length < 6) {
        signupError.textContent = 'Password must be at least 6 characters';
        return;
      }

      signupBtn.disabled = true;
      const res = await signUpWithEmail(email, pw, { full_name: name });
      signupBtn.disabled = false;

      if (res.error) {
        signupError.textContent = res.error.message || 'Signup failed';
        return;
      }

      closeModal();
      const rt =
        new URLSearchParams(window.location.search).get('returnTo') ||
        returnToEncoded();
      window.location.href = decodeURIComponent(rt || '/');
    });

  cancelSignup &&
    cancelSignup.addEventListener('click', (e) => {
      e.preventDefault && e.preventDefault();
      showStep('rs-step-enter');
    });
}

/* -------------------- header extras (cart + auth UI) -------------------- */
export function renderHeaderExtras() {
  setCartCount(cartTotalCount());
  window.addEventListener('storage', () =>
    setCartCount(cartTotalCount())
  );

  try {
    setupAuthModal();
  } catch (e) {
    console.warn('setupAuthModal error', e);
  }

  try {
    const toggle =
      document.getElementById('rs-header-login-toggle') ||
      document.getElementById('btn_login');
    const logoutBtn =
      document.getElementById('rs-logout-btn') ||
      document.getElementById('btn_logout');

    function setUiLoggedIn(loggedIn) {
      if (toggle) toggle.style.display = loggedIn ? 'none' : '';
      if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
    }

    async function refreshAuthUI() {
      try {
        const userRes = await Promise.race([
          supabase.auth.getUser(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error('timeout')), 6000)
          ),
        ]);
        const user =
          userRes?.data?.user || userRes?.user || null;
        setUiLoggedIn(!!user);
        if (user) return;
      } catch (_) {}

      try {
        const storageKey =
          supabase.storageKey ||
          ('sb-' +
            (supabase.supabaseUrl || '')
              .replace(/https?:\/\//, '')
              .split('.')[0] +
            '-auth-token');
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          setUiLoggedIn(false);
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {
          parsed = null;
        }
        const access_token =
          parsed?.access_token ||
          parsed?.currentSession?.access_token ||
          parsed?.value?.access_token;

        if (!access_token) {
          setUiLoggedIn(false);
          return;
        }

        const url =
          supabase.supabaseUrl.replace(/\/$/, '') +
          '/auth/v1/user';
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + access_token,
            apikey: supabase.supabaseKey,
          },
          mode: 'cors',
          cache: 'no-store',
        });

        setUiLoggedIn(resp.status === 200);
      } catch (_) {
        setUiLoggedIn(false);
      }
    }

    try {
      supabase.auth.onAuthStateChange(() => {
        refreshAuthUI().catch(() => {});
      });
    } catch (_) {}

    refreshAuthUI().catch(() => {});

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        try {
          e.preventDefault && e.preventDefault();
          await supabase.auth.signOut().catch(() => {});

          const storageKey =
            supabase.storageKey ||
            ('sb-' +
              (supabase.supabaseUrl || '')
                .replace(/https?:\/\//, '')
                .split('.')[0] +
              '-auth-token');

          localStorage.removeItem(storageKey);
          Object.keys(localStorage).forEach((k) => {
            if (/supabase|sb-|auth|session|token/.test(k)) {
              localStorage.removeItem(k);
            }
          });

          alert('You have been logged out.');
          window.location.href = '/';
        } catch (_) {}
      });
    }
  } catch (e) {
    console.warn('auth wiring failed', e);
  }
}

/* -------------------- auto-run -------------------- */
try {
  renderHeaderExtras();
} catch (e) {
  console.warn('renderHeaderExtras error', e);
}
