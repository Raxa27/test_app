"use strict";
/* Login (Firebase Auth, admin-created accounts) and cloud sync (Firestore: users/{uid}). Runs after app.js.
   Until someone logs in, every tool is shown as a locked demo. */
(function () {
  const cfg = window.FF_FIREBASE_CONFIG;
  const contact = window.FF_ADMIN_CONTACT || {};
  const LOCAL = Array.isArray(window.FF_LOCAL_ACCOUNTS) ? window.FF_LOCAL_ACCOUNTS : [];
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

  /* ---------- Built-in accounts (no Firebase) ---------- */
  // Plain SHA-256 so it also works where crypto.subtle is missing (file:// and older webviews).
  function sha256(str) {
    const K = [], H = [], composite = {};
    for (let c = 2, n = 0; n < 64; c++) {
      if (composite[c]) continue;
      for (let i = c * c; i < 400; i += c) composite[i] = true;
      if (n < 8) H[n] = (Math.pow(c, 1 / 2) * 4294967296) | 0;
      K[n++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
    }
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    const bytes = new TextEncoder().encode(str), len = bytes.length, size = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(size); m.set(bytes); m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(size - 8, Math.floor((len * 8) / 4294967296)); dv.setUint32(size - 4, (len * 8) >>> 0);
    const w = new Int32Array(64), h = H.slice();
    for (let off = 0; off < size; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, k] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (k + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, k].forEach((v, i) => { h[i] = (h[i] + v) | 0; });
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  const findLocal = (name) => LOCAL.find((u) => u && u.username && u.username.toLowerCase() === String(name).toLowerCase());
  const localUser = (acc) => ({ uid: "local:" + acc.username, displayName: acc.name || acc.username, email: "", local: true });
  function localLogin(name, pass) {
    const acc = findLocal(name);
    if (!acc || sha256(pass) !== String(acc.sha256).toLowerCase()) return false;
    try { localStorage.setItem("local_session", JSON.stringify(acc.username)); } catch {}
    setUser(localUser(acc));
    return true;
  }
  function restoreLocal() {
    let name = null;
    try { name = JSON.parse(localStorage.getItem("local_session")); } catch {}
    const acc = name && findLocal(name);
    if (acc) user = localUser(acc);
  }
  function setUser(u) {
    user = u;
    renderAccount();
    if (u && location.hash === "#login") location.hash = "#home"; else window.FF.route();
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
      if (!user || user.local || applying || key === "tab") return;
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
    const email = $("a_email").value.trim(), pass = $("a_pass").value;
    if (!email) return showErr("Enter your username or email.");
    if (!pass) return showErr("Enter your password.");
    if (findLocal(email)) {
      if (localLogin(email, pass)) { showErr(""); $("a_pass").value = ""; window.FF.toast("Logged in"); }
      else showErr("Wrong username or password.");
      return;
    }
    if (!email.includes("@")) return showErr("Wrong username or password.");
    if (!auth) return showErr(cfg ? "The login service is still loading. Try again in a moment." : "Wrong username or password.");
    showErr(""); busy(true);
    try { await auth.signInWithEmailAndPassword(email, pass); }
    catch (err) { showErr(errText(err)); }
    busy(false);
  });
  $("a_forgot").onclick = async () => {
    if (!auth) return showErr("Contact the admin to reset your password.");
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
    if (user.local) {
      out.innerHTML = `
        <div class="card profile">
          <span class="profile-avatar">${initial(user)}</span>
          <div class="grow"><h3>${esc(nameOf(user))}</h3><p>Built-in account</p></div>
          <span class="pill ok">Member</span>
        </div>
        <div class="card"><div class="card-head"><h3 class="card-title">Saved on this device</h3><span class="pill mute">No cloud sync</span></div>
          <p class="note" style="margin:0">This account doesn't use Firebase, so your data stays on this device. It's still here after you log out.</p></div>
        <button class="btn btn-ghost btn-block danger-btn" id="acct_logout" type="button"><svg><use href="#i-logout"/></svg>Log out</button>`;
      $("acct_logout").onclick = () => {
        try { localStorage.removeItem("local_session"); } catch {}
        setUser(null); window.FF.toast("Logged out");
      };
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
    restoreLocal();
    renderAccount();
    if (user) window.FF.route();
    if (!cfg) return;
    try {
      await loadSdk();
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth(); db = firebase.firestore();
    } catch (e) {
      showErr("Couldn't reach the login service. Check your internet connection and reload.");
      return;
    }
    auth.onAuthStateChanged(async (u) => {
      if (!u && user && user.local) return; // a built-in account is active
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
