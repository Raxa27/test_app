"use strict";
/* Login (Firebase Auth) and cloud sync (Firestore: users/{uid}). Runs after app.js. */
(function () {
  const cfg = window.FF_FIREBASE_CONFIG;
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  let auth = null, db = null, user = null, ready = !cfg, applying = false, pushTimer = null;
  let sync = { state: "idle", at: null };

  const ERRORS = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-email": "Enter your email address.",
    "auth/missing-password": "Enter your password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "No internet connection. Check your network and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/cancelled-popup-request": "Google sign-in was cancelled.",
    "auth/operation-not-allowed": "This sign-in method isn't enabled in Firebase yet.",
    "auth/unauthorized-domain": "This website isn't on the Firebase authorized domains list.",
  };
  const errText = (e) => ERRORS[e && e.code] || `Sign-in failed (${(e && e.code) || "unknown error"}).`;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }
  async function loadSdk() {
    if (window.firebase && window.firebase.auth) return;
    for (const f of ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"]) await loadScript(SDK + f);
  }

  /* ---------- Sync ---------- */
  const docRef = () => db.collection("users").doc(user.uid);
  function setSync(state) {
    sync = { state, at: state === "synced" ? new Date() : sync.at };
    renderAccount();
  }
  async function push() {
    if (!user) return;
    setSync("saving");
    try {
      await docRef().set({ data: window.FF.exportState(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      setSync("synced");
    } catch (e) { setSync("error"); }
  }
  async function pull() {
    setSync("saving");
    try {
      const snap = await docRef().get();
      const cloud = snap.exists && snap.data().data;
      if (cloud && window.FF.hasData(cloud)) {
        applying = true;
        try { window.FF.importState(cloud); } finally { applying = false; }
        setSync("synced");
      } else {
        await push(); // first login: upload what's on this device
      }
    } catch (e) { setSync("error"); }
  }

  /* ---------- Public hooks used by app.js ---------- */
  window.FFAuth = {
    enabled: !!cfg,
    get user() { return user; },
    gate(page) {
      if (!cfg || !ready || user || page === "login" || window.FF.isGuest()) return false;
      location.replace("#login");
      return true;
    },
    onSave(key) {
      if (!user || applying || key === "tab" || key === "guest") return;
      clearTimeout(pushTimer);
      setSync("saving");
      pushTimer = setTimeout(push, 800);
    },
  };

  /* ---------- Login page ---------- */
  const $ = (id) => document.getElementById(id);
  const mode = () => (document.querySelector('input[name="a_mode"]:checked') || {}).value;
  function showErr(msg) { const el = $("a_err"); el.textContent = msg || ""; el.hidden = !msg; }
  function busy(on) {
    ["a_submit", "a_google"].forEach((id) => { $(id).disabled = on; });
    $("a_submit").classList.toggle("loading", on);
  }
  function syncMode() {
    const signup = mode() === "signup";
    $("a_name_f").hidden = !signup;
    $("a_title").textContent = signup ? "Create your account" : "Welcome back";
    $("a_submit").textContent = signup ? "Create account" : "Log in";
    $("a_pass").autocomplete = signup ? "new-password" : "current-password";
    $("a_forgot").hidden = signup;
    showErr("");
  }
  document.querySelectorAll('input[name="a_mode"]').forEach((r) => r.addEventListener("change", syncMode));
  $("a_show").onclick = () => {
    const p = $("a_pass"), show = p.type === "password";
    p.type = show ? "text" : "password";
    $("a_show").setAttribute("aria-label", show ? "Hide password" : "Show password");
  };
  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!auth) return;
    const email = $("a_email").value.trim(), pass = $("a_pass").value, name = $("a_name").value.trim();
    if (!email) return showErr("Enter your email address.");
    if (pass.length < 6) return showErr("Use a password with at least 6 characters.");
    showErr(""); busy(true);
    try {
      if (mode() === "signup") {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        if (name) { await cred.user.updateProfile({ displayName: name }); renderAccount(); }
      } else {
        await auth.signInWithEmailAndPassword(email, pass);
      }
    } catch (err) { showErr(errText(err)); }
    busy(false);
  });
  $("a_forgot").onclick = async () => {
    const email = $("a_email").value.trim();
    if (!email) return showErr("Enter your email above first, then tap “Forgot password?”.");
    try { await auth.sendPasswordResetEmail(email); window.FF.toast("Password reset email sent"); showErr(""); }
    catch (err) { showErr(errText(err)); }
  };
  $("a_google").onclick = async () => {
    if (!auth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    showErr(""); busy(true);
    try { await auth.signInWithPopup(provider); }
    catch (err) {
      if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
        try { await auth.signInWithRedirect(provider); } catch (e2) { showErr(errText(e2)); }
      } else showErr(errText(err));
    }
    busy(false);
  };
  $("a_guest").onclick = () => { window.FF.setGuest(true); location.hash = "#home"; };

  /* ---------- Account page & top bar ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nameOf = (u) => u.displayName || (u.email || "Player").split("@")[0];
  const initial = (u) => esc(nameOf(u).trim().charAt(0).toUpperCase() || "P");
  function avatarHtml(u, cls) {
    return u.photoURL ? `<img class="${cls}" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="${cls}">${initial(u)}</span>`;
  }
  function syncPill() {
    const map = {
      idle: ["mute", "Not synced yet"], saving: ["gold", "Syncing…"], synced: ["ok", "Synced"], error: ["bad", "Sync failed"],
    };
    const [cls, text] = map[sync.state];
    return `<span class="pill ${cls}">${text}</span>`;
  }
  function renderAccount() {
    const btn = $("acctBtn");
    btn.hidden = !cfg;
    btn.innerHTML = user ? avatarHtml(user, "acct-avatar") : `<svg><use href="#i-user"/></svg><span>Log in</span>`;
    btn.classList.toggle("signed", !!user);
    btn.href = user ? "#account" : "#login";

    const out = $("acct_out");
    if (!out) return;
    if (!cfg) {
      out.innerHTML = `<div class="card empty"><svg><use href="#i-cloud"/></svg>Login isn't set up yet. The app is running in guest mode and your data stays on this device.</div>`;
    } else if (!user) {
      out.innerHTML = `<div class="card empty"><svg><use href="#i-user"/></svg>You're using guest mode. Your data is saved on this device only.
        <div style="margin-top:14px"><a class="btn" href="#login">Log in or create an account</a></div></div>`;
    } else {
      const when = sync.at ? sync.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
      out.innerHTML = `
        <div class="card profile">
          ${avatarHtml(user, "profile-avatar")}
          <div class="grow"><h3>${esc(nameOf(user))}</h3><p>${esc(user.email || "")}</p></div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">Cloud sync</h3>${syncPill()}</div>
          <p class="note" style="margin:0 0 14px">Your stats, tournament, diamond goals, redeem codes and weapon edits are saved to your account and appear on every device you log in on.</p>
          <div class="sync-row"><span>Last synced</span><b>${when}</b></div>
          <button class="btn btn-ghost btn-block" id="acct_sync" type="button"><svg><use href="#i-sync"/></svg>Sync now</button>
        </div>
        <button class="btn btn-ghost btn-block danger-btn" id="acct_logout" type="button"><svg><use href="#i-logout"/></svg>Log out</button>`;
      $("acct_sync").onclick = () => push().then(() => sync.state === "synced" && window.FF.toast("Synced"));
      $("acct_logout").onclick = async () => {
        await push();
        await auth.signOut();
        window.FF.clearLocal(); // data stays in the cloud; don't leave it for the next person on this device
        window.FF.toast("Logged out");
      };
    }
  }

  /* ---------- Boot ---------- */
  async function init() {
    renderAccount();
    if (!cfg) {
      $("a_setup").hidden = false; $("a_body").hidden = true; $("a_guest").textContent = "Continue in guest mode";
      return;
    }
    if (isNative) { $("a_google").hidden = true; $("a_div").hidden = true; } // Google blocks sign-in inside app webviews
    try {
      await loadSdk();
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth(); db = firebase.firestore();
    } catch (e) {
      ready = true;
      showErr("Couldn't reach the login service. Check your internet connection, or continue in guest mode.");
      return;
    }
    auth.getRedirectResult().catch((err) => showErr(errText(err)));
    auth.onAuthStateChanged(async (u) => {
      const wasReady = ready;
      user = u; ready = true;
      renderAccount();
      if (u) {
        window.FF.setGuest(false);
        await pull();
        if (location.hash === "#login") location.hash = "#home";
      } else if (!wasReady || location.hash === "#account") {
        window.FF.route();
      }
    });
  }
  syncMode();
  init();
})();
