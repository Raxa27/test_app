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
  function sha256Bytes(bytes) {
    const K = [], H = [], composite = {};
    for (let c = 2, n = 0; n < 64; c++) {
      if (composite[c]) continue;
      for (let i = c * c; i < 400; i += c) composite[i] = true;
      if (n < 8) H[n] = (Math.pow(c, 1 / 2) * 4294967296) | 0;
      K[n++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
    }
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    const len = bytes.length, size = ((len + 9 + 63) >> 6) << 6;
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
    return Uint8Array.from(h.flatMap((x) => [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255]));
  }
  const enc = (s) => new TextEncoder().encode(s);
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  const sha256 = (str) => hex(sha256Bytes(enc(str)));
  function hmac(keyStr, msgStr) {
    let key = enc(keyStr); if (key.length > 64) key = sha256Bytes(key);
    const k = new Uint8Array(64); k.set(key);
    const msg = enc(msgStr), inner = new Uint8Array(64 + msg.length), outer = new Uint8Array(96);
    for (let i = 0; i < 64; i++) { inner[i] = k[i] ^ 0x36; outer[i] = k[i] ^ 0x5c; }
    inner.set(msg, 64); outer.set(sha256Bytes(inner), 64);
    return hex(sha256Bytes(outer));
  }

  /* ---------- Access codes: logins the admin creates in the Admin panel ---------- */
  // A code carries the username, name, password hash and expiry, signed with FF_SIGNING_KEY.
  // The member pastes it once on the login page; after that the login lives on their device.
  const KEY = String(window.FF_SIGNING_KEY || "ff-toolkit");
  const b64u = (s) => btoa(String.fromCharCode(...enc(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  function makeCode(p) {
    const body = b64u(JSON.stringify(p));
    return `FFK1.${body}.${hmac(KEY, body).slice(0, 24)}`;
  }
  function readCode(code) {
    const m = /^FFK1\.([A-Za-z0-9_-]+)\.([0-9a-f]{24})$/.exec(String(code).replace(/\s+/g, ""));
    if (!m || hmac(KEY, m[1]).slice(0, 24) !== m[2]) return null;
    try { const p = JSON.parse(unb64u(m[1])); return p && p.u && p.h ? p : null; } catch { return null; }
  }
  const loadMembers = () => { try { return JSON.parse(localStorage.getItem("member_accounts")) || []; } catch { return []; } };
  const saveMembers = (list) => { try { localStorage.setItem("member_accounts", JSON.stringify(list)); } catch {} };
  const expired = (acc) => !!acc.e && Date.now() > acc.e;
  const fmtDate = (ms) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  // Built-in accounts from the config file, then members activated on this device with an access code.
  const allAccounts = () => [
    ...LOCAL.filter((u) => u && u.username).map((u) => ({ username: u.username, name: u.name, sha256: u.sha256, role: u.role || "admin", e: 0 })),
    ...loadMembers().map((p) => ({ username: p.u, name: p.n, sha256: p.h, role: "member", e: p.e || 0 })),
  ];
  const findLocal = (name) => allAccounts().find((u) => u.username.toLowerCase() === String(name).toLowerCase());
  const localUser = (acc) => ({ uid: "local:" + acc.username, displayName: acc.name || acc.username, email: "", local: true, role: acc.role, expires: acc.e });
  function localLogin(name, pass) {
    const acc = findLocal(name);
    if (!acc || sha256(pass) !== String(acc.sha256).toLowerCase()) return false;
    if (expired(acc)) return "expired";
    try { localStorage.setItem("local_session", JSON.stringify(acc.username)); } catch {}
    setUser(localUser(acc));
    return true;
  }
  function restoreLocal() {
    let name = null;
    try { name = JSON.parse(localStorage.getItem("local_session")); } catch {}
    const acc = name && findLocal(name);
    if (acc && !expired(acc)) user = localUser(acc);
    else if (acc) { try { localStorage.removeItem("local_session"); } catch {} }
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
    const code = $("a_code").value.trim();
    if (code) {
      const p = readCode(code);
      if (!p) return showErr("That access code isn't valid. Copy the whole code from the admin's message.");
      if (p.u.toLowerCase() !== email.toLowerCase()) return showErr("This access code is for a different username.");
      if (p.e && Date.now() > p.e) return showErr(`This access code expired on ${fmtDate(p.e)}. Contact the admin for a new one.`);
      if (LOCAL.some((u) => u.username && u.username.toLowerCase() === p.u.toLowerCase())) return showErr("This username is reserved.");
      saveMembers([...loadMembers().filter((m) => m.u.toLowerCase() !== p.u.toLowerCase()), p]);
    }
    if (findLocal(email)) {
      const r = localLogin(email, pass);
      if (r === "expired") showErr(`Your access expired on ${fmtDate(findLocal(email).e)}. Contact the admin to renew it.`);
      else if (r) { showErr(""); $("a_pass").value = ""; $("a_code").value = ""; window.FF.toast("Logged in"); }
      else showErr("Wrong username or password.");
      return;
    }
    if (!email.includes("@")) return showErr("No account with that username on this device. If the admin sent you an access code, open “First time here?” and paste it.");
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
    document.body.classList.toggle("is-admin", isAdmin());

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
          <div class="grow"><h3>${esc(nameOf(user))}</h3><p>@${esc(user.uid.slice(6))}${user.expires ? ` · access until ${fmtDate(user.expires)}` : ""}</p></div>
          <span class="pill ${isAdmin() ? "gold" : "ok"}">${isAdmin() ? "Admin" : "Member"}</span>
        </div>
        ${isAdmin() ? `<a class="btn btn-block admin-cta" href="#admin"><svg><use href="#i-shield"/></svg>Admin panel: add users</a>` : ""}
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

  /* ---------- Admin panel (built-in admin accounts only) ---------- */
  const isAdmin = () => !!(user && user.local && user.role === "admin");
  const PERIODS = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["0", "No expiry"]];
  const loadIssued = () => { try { return JSON.parse(localStorage.getItem("issued_logins")) || []; } catch { return []; } };
  const saveIssued = (l) => { try { localStorage.setItem("issued_logins", JSON.stringify(l)); } catch {} };
  function randomPass() {
    const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = new Uint32Array(10);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => { r[i] = Math.random() * 1e9; });
    return Array.from(r, (x) => abc[x % abc.length]).join("");
  }
  const message = (n, u, pass, code, e) => `FF Toolkit login${n ? ` for ${n}` : ""}

Username: ${u}
Password: ${pass}
Access: ${e ? `until ${fmtDate(e)}` : "no expiry"}

First login: open the app, tap Log in, enter your username and password, then open "First time here?" and paste this access code:

${code}`;
  let lastMsg = "";
  function renderAdmin() {
    const page = $("admin");
    if (!page.dataset.ready) {
      page.dataset.ready = "1";
      page.innerHTML = `
        <div class="layout-2">
          <div class="card">
            <h3 class="card-title">Add a user</h3>
            <form id="ad_form" novalidate>
              <div class="field"><label for="ad_name">Name</label><input id="ad_name" maxlength="24" placeholder="Player name (optional)"></div>
              <div class="field"><label for="ad_user">Username</label><input id="ad_user" maxlength="20" autocapitalize="none" spellcheck="false" placeholder="e.g. ali07"></div>
              <div class="field"><label for="ad_pass">Password</label>
                <div class="pass-wrap"><input id="ad_pass" maxlength="40" autocapitalize="none" spellcheck="false" placeholder="At least 6 characters">
                <button type="button" class="btn btn-ghost btn-sm" id="ad_gen">Generate</button></div></div>
              <div class="field"><span class="label">Access period</span>
                <div class="seg">${PERIODS.map(([v, l], i) => `<label><input type="radio" name="ad_days" value="${v}" ${i === 1 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
              <p id="ad_err" class="form-err" role="alert" hidden></p>
              <button class="btn btn-block" type="submit"><svg><use href="#i-plus"/></svg>Create login</button>
            </form>
          </div>
          <div class="card" id="ad_result_card">
            <h3 class="card-title">Send this to the user</h3>
            <div id="ad_result"><div class="empty"><svg><use href="#i-shield"/></svg>Create a login and the message to send appears here.</div></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">Logins you've created</h3><span class="pill mute" id="ad_count"></span></div>
          <div id="ad_list" class="list"></div>
          <p class="note">This list is kept on this device. A login keeps working on the member's phone until it expires, so use short access periods if you may need to cut someone off.</p>
        </div>`;
      $("ad_gen").onclick = () => { $("ad_pass").value = randomPass(); };
      $("ad_form").addEventListener("submit", createLogin);
      $("ad_list").addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        const list = loadIssued(), item = list[+b.dataset.i];
        if (!item) return;
        if (b.dataset.act === "copy") window.FF.copy(item.code, b);
        if (b.dataset.act === "del") { list.splice(+b.dataset.i, 1); saveIssued(list); renderIssued(); }
      });
      $("ad_result").addEventListener("click", (e) => {
        const b = e.target.closest("[data-copy-msg]"); if (b) window.FF.copy(lastMsg, b);
      });
    }
    renderIssued();
  }
  function renderIssued() {
    const list = loadIssued();
    $("ad_count").textContent = `${list.length} total`;
    $("ad_list").innerHTML = list.length ? list.map((x, i) => {
      const exp = x.e && Date.now() > x.e;
      return `<div class="item" style="--i:${i}"><span class="avatar sm" style="--h:${(x.u.charCodeAt(0) * 37) % 360}">${esc(x.u.charAt(0).toUpperCase())}</span>
        <div class="grow"><div class="title">${esc(x.n || x.u)} <span class="pill ${exp ? "bad" : "ok"}">${exp ? "Expired" : "Active"}</span></div>
        <div class="meta">@${esc(x.u)} · ${x.e ? `${exp ? "expired" : "until"} ${fmtDate(x.e)}` : "no expiry"} · created ${fmtDate(x.i)}</div></div>
        <div class="actions"><button class="icon-btn" data-act="copy" data-i="${i}" aria-label="Copy access code"><svg><use href="#i-copy"/></svg></button>
        <button class="icon-btn danger" data-act="del" data-i="${i}" aria-label="Remove from list"><svg><use href="#i-trash"/></svg></button></div></div>`;
    }).join("") : `<div class="empty"><svg><use href="#i-teams"/></svg>No logins created yet.</div>`;
  }
  function createLogin(e) {
    e.preventDefault();
    const err = (m) => { $("ad_err").textContent = m; $("ad_err").hidden = !m; };
    const n = $("ad_name").value.trim().slice(0, 24), u = $("ad_user").value.trim().toLowerCase(), pass = $("ad_pass").value;
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) return err("Usernames are 3–20 characters: letters, numbers, dots or underscores.");
    if (LOCAL.some((x) => x.username && x.username.toLowerCase() === u)) return err("That username is reserved for a built-in account.");
    if (pass.length < 6) return err("Use a password with at least 6 characters, or tap Generate.");
    err("");
    const days = +(document.querySelector('input[name="ad_days"]:checked') || {}).value || 0;
    const now = Date.now(), exp = days ? now + days * 864e5 : 0;
    const code = makeCode({ u, n, h: sha256(pass), e: exp, i: now });
    saveIssued([{ u, n, e: exp, i: now, code }, ...loadIssued().filter((x) => x.u !== u)]);
    lastMsg = message(n, u, pass, code, exp);
    $("ad_result").innerHTML = `<pre class="msg-box">${esc(lastMsg)}</pre>
      <div class="row-btns"><button class="btn" type="button" data-copy-msg><svg><use href="#i-copy"/></svg>Copy message</button>
      <a class="btn btn-ghost" href="https://wa.me/?text=${encodeURIComponent(lastMsg)}" target="_blank" rel="noopener">Share on WhatsApp</a></div>
      <p class="note">The password isn't saved anywhere, so copy this message now.</p>`;
    ["ad_name", "ad_user", "ad_pass"].forEach((id) => { $(id).value = ""; });
    renderIssued();
    window.FF.toast(`Login created for @${u}`);
    $("ad_result_card").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  onShow.admin = renderAdmin;
  window.FFAuth.isAdmin = isAdmin;

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
