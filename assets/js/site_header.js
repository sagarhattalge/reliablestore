import { supabase } from '/assets/js/supabase_client.js';

// Prevent accidental auto-open
window.__rs_block_auto_modal = true;

// shorthand helpers
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const getReturnTo = () => window.location.pathname + window.location.search + window.location.hash;
const returnToEncoded = () => encodeURIComponent(getReturnTo() || "/");

/* ---------------- CART HELPERS ---------------- */
function readCart() {
  try { return JSON.parse(localStorage.getItem("rs_cart_v1") || "{}"); }
  catch (e) { return {}; }
}
function cartTotalCount() {
  const c = readCart();
  return Object.values(c).reduce((s, i) => s + (i.qty || 0), 0);
}
function setCartCount(n) {
  const el1 = document.getElementById("cart-count");
  const el2 = document.getElementById("cart_count");
  if (el1) el1.innerText = String(n || 0);
  if (el2) el2.innerText = String(n || 0);
}

/* ---------------- MODAL OPEN/CLOSE ---------------- */
function openModal() {
  const m = $("#rs-auth-modal");
  if (!m) return;

  m.style.display = "flex";
  m.style.alignItems = "center";
  m.style.justifyContent = "center";

  m.classList.remove("hidden");
  m.removeAttribute("aria-hidden");

  setTimeout(() => {
    const input = m.querySelector("input");
    if (input) input.focus();
  }, 120);
}

function closeModal() {
  const m = $("#rs-auth-modal");
  if (!m) return;

  m.classList.add("hidden");
  m.setAttribute("aria-hidden", "true");
  m.style.display = "none";
}

/* ---------------- MODAL STEP SHOW/HIDE ---------------- */
function showStep(id) {
  $all(".rs-step").forEach((s) => s.classList.add("hidden"));
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

/* ---------------- SUPABASE HELPERS ---------------- */
async function checkExistingByEmail(email) {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id,email")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return !!data;
  } catch {
    return null;
  }
}

async function signInWithPassword(email, password) {
  try {
    return await supabase.auth.signInWithPassword({ email, password });
  } catch (e) {
    return { error: e };
  }
}

async function signUpWithEmail(email, password, meta = {}) {
  try {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    });
  } catch (e) {
    return { error: e };
  }
}

/* ---------------- MODAL WIRED LOGIC ---------------- */
function setupAuthModal() {
  const toggle = $("#rs-header-login-toggle");
  const modal = $("#rs-auth-modal");

  if (!toggle || !modal) return;

  // Ensure proper default state
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.display = "none";
  modal.style.zIndex = "1200";

  /* --- Form elements --- */
  const identifierInput = $("#rs-identifier");
  const identifierNext = $("#rs-identifier-next");
  const identifierError = $("#rs-identifier-error");

  const knownEmailText = $("#rs-known-email");
  const passwordInput = $("#rs-password");
  const signinBtn = $("#rs-signin-btn");
  const passwordError = $("#rs-password-error");

  const signupEmail = $("#rs-signup-email");
  const signupName = $("#rs-signup-name");
  const signupPassword = $("#rs-signup-password");
  const signupBtn = $("#rs-signup-btn");
  const signupError = $("#rs-signup-error");

  const backToEnter = $("#rs-back-to-enter");
  const cancelSignup = $("#rs-cancel-signup");

  /* --- Open modal --- */
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
    showStep("rs-step-enter");
    identifierInput.value = "";
    identifierError.textContent = "";
    identifierInput.focus();
  });

  /* --- Close modal ONLY by X or Cancel (Option B) --- */
  $all("[data-rs-close]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    })
  );

  // 🔥 NO outside-click close (Option B)

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  /* --- Back button --- */
  backToEnter?.addEventListener("click", (e) => {
    e.preventDefault();
    showStep("rs-step-enter");
  });

  /* ---------------- STEP 1: IDENTIFIER ---------------- */
  identifierNext?.addEventListener("click", async (e) => {
    e.preventDefault();
    identifierError.textContent = "";

    const raw = identifierInput.value.trim();
    if (!raw) {
      identifierError.textContent =
        "Please enter your email or mobile number";
      return;
    }

    /* ---- PHONE LOGIN ---- */
    if (/^\d{10,}$/.test(raw)) {
      try {
        const { data } = await supabase
          .from("customers")
          .select("email,phone")
          .eq("phone", raw)
          .limit(1)
          .maybeSingle();

        if (data?.email) {
          knownEmailText.textContent = data.email;
          passwordInput.value = "";
          showStep("rs-step-password");
        } else {
          signupEmail.value = "";
          signupName.value = "";
          signupPassword.value = "";
          showStep("rs-step-signup");
          signupEmail.focus();
        }
      } catch {
        identifierError.textContent = "Unable to check right now";
      }
      return;
    }

    /* ---- EMAIL LOGIN ---- */
    const email = raw;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      identifierError.textContent = "Please enter a valid email address";
      return;
    }

    identifierNext.disabled = true;
    const exists = await checkExistingByEmail(email);
    identifierNext.disabled = false;

    if (exists === true) {
      knownEmailText.textContent = email;
      passwordInput.value = "";
      passwordError.textContent = "";
      showStep("rs-step-password");
    } else if (exists === false) {
      signupEmail.value = email;
      signupName.value = "";
      signupPassword.value = "";
      showStep("rs-step-signup");
      signupPassword.focus();
    } else {
      knownEmailText.textContent = email;
      passwordInput.value = "";
      showStep("rs-step-password");
    }
  });

  /* ---------------- STEP 2: SIGN IN ---------------- */
  signinBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    passwordError.textContent = "";

    const email = knownEmailText.textContent.trim();
    const pw = passwordInput.value.trim();

    if (!email || !pw) {
      passwordError.textContent = "Enter your password";
      return;
    }

    signinBtn.disabled = true;
    const res = await signInWithPassword(email, pw);
    signinBtn.disabled = false;

    if (res.error) {
      passwordError.textContent = res.error.message || "Sign in failed";
      return;
    }

    try {
      if (res.data?.session) {
        await supabase.auth.setSession({
          access_token: res.data.session.access_token,
          refresh_token: res.data.session.refresh_token,
        });
      }
    } catch {}

    closeModal();

    const rt =
      new URLSearchParams(window.location.search).get("returnTo") ||
      returnToEncoded();
    window.location.href = decodeURIComponent(rt || "/");
  });

  /* ---------------- STEP 3: SIGN UP ---------------- */
  signupBtn?.addEventListener("click", async (e) => {
    e.preventDefault();

    signupError.textContent = "";
    const email = signupEmail.value.trim();
    const name = signupName.value.trim();
    const pw = signupPassword.value.trim();

    if (!email || !name || !pw) {
      signupError.textContent = "Fill name, email and password";
      return;
    }
    if (pw.length < 6) {
      signupError.textContent = "Password must be at least 6 characters";
      return;
    }

    signupBtn.disabled = true;
    const res = await signUpWithEmail(email, pw, { full_name: name });
    signupBtn.disabled = false;

    if (res.error) {
      signupError.textContent = res.error.message || "Signup failed";
      return;
    }

    closeModal();
    const rt =
      new URLSearchParams(window.location.search).get("returnTo") ||
      returnToEncoded();
    window.location.href = decodeURIComponent(rt || "/");
  });

  cancelSignup?.addEventListener("click", (e) => {
    e.preventDefault();
    showStep("rs-step-enter");
  });
}

/* ---------------- HEADER UI LOGIN/LOGOUT ---------------- */
export function renderHeaderExtras() {
  // cart count
  setCartCount(cartTotalCount());
  window.addEventListener("storage", () =>
    setCartCount(cartTotalCount())
  );

  setupAuthModal();

  const toggle = $("#rs-header-login-toggle");
  const logoutBtn = $("#rs-logout-btn");

  function setUi(loggedIn) {
    if (toggle) toggle.style.display = loggedIn ? "none" : "";
    if (logoutBtn) logoutBtn.style.display = loggedIn ? "" : "none";
  }

  async function refreshAuthUI() {
    try {
      const res = await supabase.auth.getUser();
      const user = res?.data?.user || null;
      setUi(!!user);
      if (user) return;
    } catch {}

    // fallback token validation
    try {
      const storageKey =
        supabase.storageKey ||
        "sb-" +
          supabase.supabaseUrl.replace(/https?:\/\//, "").split(".")[0] +
          "-auth-token";

      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setUi(false);
        return;
      }

      const parsed = JSON.parse(raw);
      const token =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.value?.access_token;

      if (!token) {
        setUi(false);
        return;
      }

      const url =
        supabase.supabaseUrl.replace(/\/$/, "") + "/auth/v1/user";

      const r = await fetch(url, {
        headers: {
          Authorization: "Bearer " + token,
          apikey: supabase.supabaseKey,
        },
        cache: "no-store",
      });

      setUi(r.status === 200);
    } catch {
      setUi(false);
    }
  }

  supabase.auth.onAuthStateChange(() => refreshAuthUI());
  refreshAuthUI();

  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await supabase.auth.signOut().catch(() => {});
    alert("You have been logged out.");
    window.location.href = "/";
  });
}

/* ---------------- AUTO RUN ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderHeaderExtras();
});
