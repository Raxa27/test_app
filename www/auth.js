"use strict";
/* Login (Firebase Auth, admin-created accounts) and cloud sync (Firestore: users/{uid}). Runs after app.js.
   Until someone logs in, every tool is shown as a locked demo. */
(function () {
  const cfg = window.FF_FIREBASE_CONFIG;
  const contact = window.FF_ADMIN_CONTACT || {};
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  let auth = null, db = null, user = null, applying = false, pushTimer = null;
  let sync = { state: "idle", at: null };

  const ERRORS = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-email": "Enter your email address.",
    "auth/missing-password": "Enter your password.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/user-disabled": "This account has been disabled. Contact the admin.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "No internet connection. Check your network and try again.",
    "auth/operation-not-allowed": "Email login isn't enabled in Firebase yet.",
  };
  const errText = (e) => ERRORS[e && e.code] || `Login failed (${(e && e.code) || "unknown error"}).`;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

  /* ---------- Admin contact ---------- */
  function contactHtml() {
    if (!contact.value) return "";
    const v = esc(contact.value), l = contact.label ? `<span>${esc(contact.label)}</span>` : "";
    const link = /^https:\/\//.test(contact.href || "") ? `<a href="${esc(contact.href)}" target="_blank" rel="noopener">${v}</a>` : `<b>${v}</b>`;
    return `${l}${link}<button class="icon-btn" type="button" data-copy-contact aria-label="Copy contact"><svg><use href="#i-copy"/></svg></button>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy-contact]");
    if (b) window.FF.copy(contact.value, b);
  });

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
      if (cloud) {
        applying = true;
        try { window.FF.importState(cloud); } finally { applying = false; }
        setSync("synced");
      } else {
        await push(); // first login: start the cloud copy
      }
    } catch (e) { setSync("error"); }
  }

  /* ---------- Hooks used by app.js ---------- */
  window.FFAuth = {
    enabled: !!cfg,
    get user() { return user; },
    contactHtml,
    onSave(key) {
      if (!user || applying || key === "tab") return;
      clearTimeout(pushTimer);
      setSync("saving");
      pushTimer = setTimeout(push, 800);
    },
  };

  /* ---------- Login form ---------- */
  function showErr(msg) { const el = $("a_err"); el.textContent = msg || ""; el.hidden = !msg; }
  function busy(on) { $("a_submit").disabled = on; $("a_submit").classList.toggle("loading", on); }
  $("a_show").onclick = () => {
    const p = $("a_pass"), show = p.type === "password";
    p.type = show ? "text" : "password";
    $("a_show").setAttribute("aria-label", show ? "Hide password" : "Show password");
  };
  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!auth) return showErr(cfg ? "The login service is still loading. Try again in a moment." : "Login isn't set up yet. Contact the admin.");
    const email = $("a_email").value.trim(), pass = $("a_pass").value;
    if (!email) return showErr("Enter your email address.");
    if (!pass) return showErr("Enter your password.");
    showErr(""); busy(true);
    try { await auth.signInWithEmailAndPassword(email, pass); }
    catch (err) { showErr(errText(err)); }
    busy(false);
  });
  $("a_forgot").onclick = async () => {
    if (!auth) return showErr("Login isn't set up yet. Contact the admin.");
    const email = $("a_email").value.trim();
    if (!email) return showErr("Enter your email above, then tap “Forgot password?” again.");
    try { await auth.sendPasswordResetEmail(email); window.FF.toast("Password reset email sent"); showErr(""); }
    catch (err) { showErr(errText(err)); }
  };

  /* ---------- Account page & top bar ---------- */
  const nameOf = (u) => u.displayName || (u.email || "Player").split("@")[0];
  const initial = (u) => esc(nameOf(u).trim().charAt(0).toUpperCase() || "P");
  function syncPill() {
    const map = { idle: ["mute", "Not synced yet"], saving: ["gold", "Syncing…"], synced: ["ok", "Synced"], error: ["bad", "Sync failed"] };
    const [cls, text] = map[sync.state];
    return `<span class="pill ${cls}">${text}</span>`;
  }
  function renderAccount() {
    const btn = $("acctBtn");
    btn.hidden = false;
    btn.innerHTML = user ? `<span class="acct-avatar">${initial(user)}</span>` : `<svg><use href="#i-lock"/></svg><span>Log in</span>`;
    btn.classList.toggle("signed", !!user);
    btn.href = user ? "#account" : "#login";
    document.querySelectorAll("[data-contact]").forEach((el) => { el.innerHTML = contactHtml(); el.hidden = !contact.value; });

    const out = $("acct_out");
    if (!user) {
      out.innerHTML = `<div class="card empty"><svg><use href="#i-lock"/></svg>You're viewing the demo. Log in to unlock every tool and sync your data.
        <div style="margin-top:14px"><a class="btn" href="#login">Log in</a></div></div>`;
      return;
    }
    const when = sync.at ? sync.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    out.innerHTML = `
      <div class="card profile">
        <span class="profile-avatar">${initial(user)}</span>
        <div class="grow"><h3>${esc(nameOf(user))}</h3><p>${esc(user.email || "")}</p></div>
        <span class="pill ok">Member</span>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">Cloud sync</h3>${syncPill()}</div>
        <p class="note" style="margin:0 0 14px">Your stats, tournament, diamond goals, practice streak and best scores are saved to your account and appear on every device you log in on.</p>
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

  /* ---------- Boot ---------- */
  async function init() {
    renderAccount();
    if (!cfg) { $("a_setup").hidden = false; return; }
    try {
      await loadSdk();
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth(); db = firebase.firestore();
    } catch (e) {
      showErr("Couldn't reach the login service. Check your internet connection and reload.");
      return;
    }
    auth.onAuthStateChanged(async (u) => {
      user = u;
      renderAccount();
      if (u) {
        await pull();
        if (location.hash === "#login") location.hash = "#home"; else window.FF.route();
      } else {
        window.FF.route();
      }
    });
  }
  init();
})();
