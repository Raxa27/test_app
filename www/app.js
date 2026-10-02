"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (id) => parseFloat($(id).value) || 0;

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { toast("Storage full ya blocked hai"); }
}
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { toast("Copy nahi hua, manually select karo"); }
}

/* ---------- Tabs ---------- */
document.querySelectorAll("#tabs button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === b.dataset.tab));
    save("tab", b.dataset.tab);
    b.scrollIntoView({ block: "nearest", inline: "center" });
  };
});
{
  const t = load("tab", "sens");
  const b = document.querySelector(`#tabs button[data-tab="${t}"]`);
  if (b) b.click();
}

/* ---------- Sensitivity ---------- */
const SENS_BASE = {
  //            General RedDot 2x  4x  AWM FreeLook
  rusher:   [95, 90, 85, 80, 60, 70],
  balanced: [85, 80, 75, 70, 50, 60],
  sniper:   [75, 70, 70, 65, 45, 55],
};
const SENS_LABELS = ["General", "Red Dot", "2x Scope", "4x Scope", "AWM Scope", "Free Look"];
$("s_go").onclick = () => {
  const size = clamp(num("s_size"), 4, 13);
  const ram = clamp(num("s_ram"), 1, 24);
  const claw = parseInt($("s_claw").value, 10);
  let f = 1 + (size - 6.5) * 0.03;          // bigger screen -> slightly higher
  if (ram <= 3) f -= 0.05;                  // low-end device: easier control
  f += (claw - 3) * 0.02;                   // more fingers -> slightly higher
  const vals = SENS_BASE[$("s_style").value].map((v) => clamp(Math.round(v * f), 1, 100));
  $("s_out").innerHTML = "<table>" + SENS_LABELS.map((l, i) =>
    `<tr><td>${l}</td><td class="big">${vals[i]}</td><td style="width:45%"><div class="bar"><i style="width:${vals[i]}%"></i></div></td></tr>`).join("") + "</table>";
};

/* ---------- Weapons ---------- */
// Approximate, editable values: [name, damage, rounds/sec, magazine, headshot multiplier, effective range (m)]
const DEFAULT_WEAPONS = [
  ["MP40", 18, 14, 20, 1.8, 30],
  ["UMP", 22, 9, 20, 1.8, 40],
  ["M1887", 70, 1.2, 2, 1.5, 12],
  ["M4A1", 24, 8, 30, 1.8, 55],
  ["AK47", 30, 6.5, 30, 1.8, 55],
  ["SCAR", 22, 8.5, 30, 1.8, 55],
  ["Groza", 34, 8, 30, 1.8, 60],
  ["Woodpecker", 52, 2, 10, 1.8, 90],
  ["M82B", 90, 0.6, 5, 2.5, 150],
  ["AWM", 110, 0.5, 5, 2.5, 150],
];
const W = { damage: 1, rate: 2, mag: 3, hs: 4, range: 5 };
let weapons = load("weapons", DEFAULT_WEAPONS);
function fillWeaponSelects() {
  ["d_weapon", "c_a", "c_b"].forEach((id, k) => {
    const el = $(id), cur = el.value;
    el.innerHTML = weapons.map((w, i) => `<option value="${i}">${esc(w[0])}</option>`).join("");
    el.value = cur && weapons[cur] ? cur : String(k === 2 ? Math.min(1, weapons.length - 1) : 0);
  });
}
const ARMOR = [1, 0.9, 0.8, 0.7]; // damage multiplier per armor level (approximate)
function distFactor(w, d) {
  if (d <= w[W.range]) return 1;
  return clamp(1 - 0.5 * ((d - w[W.range]) / w[W.range]), 0.5, 1);
}
$("d_go").onclick = () => {
  const w = weapons[+$("d_weapon").value];
  if (!w) return;
  const d = Math.max(0, num("d_dist")), hp = Math.max(1, num("d_hp"));
  const f = distFactor(w, d);
  const body = w[W.damage] * f * ARMOR[+$("d_vest").value];
  const head = w[W.damage] * w[W.hs] * f * ARMOR[+$("d_helm").value];
  const row = (label, dmg) => {
    const shots = Math.ceil(hp / dmg);
    const ttk = shots <= 1 ? 0 : (shots - 1) / w[W.rate];
    const ok = shots <= w[W.mag];
    return `<tr><td>${label}</td><td>${dmg.toFixed(1)}</td><td>${shots}</td><td>${ttk.toFixed(2)}s</td><td class="${ok ? "ok" : "bad"}">${ok ? "1 mag" : "mag kam"}</td></tr>`;
  };
  $("d_out").innerHTML = `<table><tr><th>Hit</th><th>Dmg</th><th>Shots to kill</th><th>TTK</th><th></th></tr>${row("Headshot", head)}${row("Body", body)}</table>
    <p class="hint">Range falloff: ${Math.round((1 - f) * 100)}% reduction at ${d}m.</p>`;
};
function renderCompare() {
  const a = weapons[+$("c_a").value], b = weapons[+$("c_b").value];
  if (!a || !b) { $("c_out").innerHTML = ""; return; }
  const dps = (w) => w[W.damage] * w[W.rate];
  const stats = [["Damage", W.damage], ["Fire rate", W.rate], ["Magazine", W.mag], ["Headshot x", W.hs], ["Range (m)", W.range]];
  let rows = stats.map(([l, i]) => {
    const mx = Math.max(a[i], b[i]) || 1;
    return `<tr><td>${l}</td><td>${a[i]}<div class="bar"><i style="width:${(a[i] / mx) * 100}%"></i></div></td><td>${b[i]}<div class="bar"><i style="width:${(b[i] / mx) * 100}%"></i></div></td></tr>`;
  }).join("");
  const da = dps(a), db = dps(b), mx = Math.max(da, db) || 1;
  rows += `<tr><td>DPS</td><td>${da.toFixed(0)}<div class="bar"><i style="width:${(da / mx) * 100}%"></i></div></td><td>${db.toFixed(0)}<div class="bar"><i style="width:${(db / mx) * 100}%"></i></div></td></tr>`;
  $("c_out").innerHTML = `<table><tr><th></th><th>${esc(a[0])}</th><th>${esc(b[0])}</th></tr>${rows}</table>`;
}
function renderWeaponEditor() {
  $("c_edit").innerHTML = `<div class="edit-row"><b>Name</b><b>Dmg</b><b>RPS</b><b>Mag</b><b>HS×</b><b>Range</b></div>` +
    weapons.map((w, i) => `<div class="edit-row">${w.map((v, j) =>
      `<input data-i="${i}" data-j="${j}" value="${esc(v)}" ${j ? 'type="number" step="any"' : ""}>`).join("")}</div>`).join("");
}
$("c_edit").addEventListener("change", (e) => {
  const { i, j } = e.target.dataset;
  if (i === undefined) return;
  weapons[i][j] = +j === 0 ? e.target.value.slice(0, 20) : Math.max(0.01, parseFloat(e.target.value) || 0.01);
  save("weapons", weapons); fillWeaponSelects(); renderCompare();
});
$("c_reset").onclick = () => {
  weapons = JSON.parse(JSON.stringify(DEFAULT_WEAPONS)); save("weapons", weapons);
  fillWeaponSelects(); renderWeaponEditor(); renderCompare(); toast("Reset ho gaya");
};
$("c_a").onchange = $("c_b").onchange = renderCompare;
fillWeaponSelects(); renderWeaponEditor(); renderCompare();

/* ---------- Characters ---------- */
const CHARS = {
  rush: [["Hayato", "Armor penetration badhta hai, close fight mein strong."], ["Moco", "Hit karne pe enemy tag hota hai, push mein help."], ["Chrono", "Shield aur speed, aggressive push ke liye."]],
  heal: [["Alok", "Healing aura aur speed boost."], ["Jota", "Kill/knock pe HP recover."], ["K", "EP aur HP conversion, long fights mein useful."]],
  support: [["Alok", "Squad ko aura ka fayda milta hai."], ["Moco", "Enemy tag karke team ko info milti hai."], ["Kelly", "Sprint speed, team ke saath rotate karna easy."]],
  mobility: [["Kelly", "Sprint speed badhti hai."], ["Alok", "Move speed boost."], ["Chrono", "Speed aur shield, zone mein rotate karne ke liye."]],
  defense: [["Skyler", "Gloo walls todne mein help."], ["Steffie", "Gloo walls repair/strong karti hai."], ["Wukong", "Bush mein transform, hide aur ambush."]],
};
function renderChars() {
  $("ch_out").innerHTML = CHARS[$("ch_role").value].map(([n, d], i) =>
    `<div class="item"><div><b>${i === 0 ? "★ " : ""}${esc(n)}</b><br><small>${esc(d)}</small></div></div>`).join("");
}
$("ch_role").onchange = renderChars; renderChars();

/* ---------- Match stats ---------- */
let matches = load("matches", []);
function renderStats() {
  const n = matches.length;
  const sum = (k) => matches.reduce((a, m) => a + m[k], 0);
  const wins = matches.filter((m) => m.rank === 1).length;
  const deaths = n - wins; // approximation: a non-win match ends with one death
  const kd = n ? (sum("kills") / Math.max(1, deaths)).toFixed(2) : "0.00";
  $("m_sum").innerHTML = [["Matches", n], ["Win %", n ? Math.round((wins / n) * 100) : 0], ["Avg kills", n ? (sum("kills") / n).toFixed(1) : "0.0"], ["K/D", kd]]
    .map(([l, v]) => `<div class="card"><b>${v}</b><span>${l}</span></div>`).join("");
  const last = matches.slice(-10);
  if (last.length) {
    const mx = Math.max(1, ...last.map((m) => m.kills)), bw = 300 / 10;
    $("m_chart").innerHTML = `<svg class="chart" viewBox="0 0 300 100" role="img" aria-label="Last matches kills">` + last.map((m, i) => {
      const h = (m.kills / mx) * 70;
      return `<rect x="${i * bw + 4}" y="${95 - h}" width="${bw - 8}" height="${h}" rx="3" fill="${m.rank === 1 ? "#4cc38a" : "#ff7a1a"}"/><text x="${i * bw + bw / 2}" y="${91 - h}" font-size="8" fill="#f3ece4" text-anchor="middle">${m.kills}</text>`;
    }).join("") + `</svg><p class="hint">Last ${last.length} matches ke kills (green = Booyah)</p>`;
  } else $("m_chart").innerHTML = "";
  $("m_list").innerHTML = matches.slice(-10).reverse().map((m) => {
    const idx = matches.indexOf(m);
    return `<div class="item"><div>${esc(m.mode)} · Rank #${m.rank} · ${m.kills} kills · ${m.dmg} dmg<br><small>${esc(m.date)}</small></div><button class="x" data-del="${idx}" aria-label="Delete">✕</button></div>`;
  }).join("");
}
$("m_add").onclick = () => {
  matches.push({ mode: $("m_mode").value, kills: Math.max(0, Math.floor(num("m_kills"))), dmg: Math.max(0, Math.floor(num("m_dmg"))), rank: Math.max(1, Math.floor(num("m_rank"))), date: new Date().toLocaleString() });
  save("matches", matches); renderStats(); toast("Match add ho gaya");
};
$("m_list").onclick = (e) => { const i = e.target.dataset.del; if (i !== undefined) { matches.splice(+i, 1); save("matches", matches); renderStats(); } };
$("m_clear").onclick = () => { if (confirm("Saare matches delete karne hain?")) { matches = []; save("matches", matches); renderStats(); } };
$("m_export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(matches, null, 2)], { type: "application/json" }));
  a.download = "ff-matches.json"; a.click(); URL.revokeObjectURL(a.href);
};
$("m_import").onchange = async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data)) throw 0;
    matches = data.map((m) => ({ mode: String(m.mode || "BR").slice(0, 10), kills: Math.max(0, +m.kills || 0), dmg: Math.max(0, +m.dmg || 0), rank: Math.max(1, +m.rank || 1), date: String(m.date || "") }));
    save("matches", matches); renderStats(); toast("Import ho gaya");
  } catch { toast("File sahi nahi hai"); }
  e.target.value = "";
};
renderStats();

/* ---------- Tournament ---------- */
const PLACE_PTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
let tour = load("tour", { teams: [] }); // teams: {name, results:[{place,kills}]}
function teamPts(t) { return t.results.reduce((a, r) => a + (PLACE_PTS[r.place - 1] || 0) + r.kills, 0); }
function renderTour() {
  $("t_sel").innerHTML = tour.teams.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join("");
  const rows = tour.teams.map((t) => ({ t, pts: teamPts(t), kills: t.results.reduce((a, r) => a + r.kills, 0), wins: t.results.filter((r) => r.place === 1).length }))
    .sort((a, b) => b.pts - a.pts || b.kills - a.kills);
  $("t_table").innerHTML = rows.length ? `<table><tr><th>#</th><th>Team</th><th>M</th><th>Wins</th><th>Kills</th><th>Pts</th></tr>${rows.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${esc(r.t.name)}</td><td>${r.t.results.length}</td><td>${r.wins}</td><td>${r.kills}</td><td><b>${r.pts}</b></td></tr>`).join("")}</table>` : '<p class="hint">Pehle team add karo.</p>';
}
$("t_add_team").onclick = () => {
  const name = $("t_team").value.trim().slice(0, 24);
  if (!name) return toast("Team name likho");
  tour.teams.push({ name, results: [] }); $("t_team").value = ""; save("tour", tour); renderTour();
};
$("t_add_res").onclick = () => {
  const t = tour.teams[+$("t_sel").value];
  if (!t) return toast("Pehle team add karo");
  t.results.push({ place: Math.max(1, Math.floor(num("t_place"))), kills: Math.max(0, Math.floor(num("t_kills"))) });
  save("tour", tour); renderTour(); toast("Result add ho gaya");
};
$("t_clear").onclick = () => { if (confirm("Poora tournament reset karna hai?")) { tour = { teams: [] }; save("tour", tour); renderTour(); } };
renderTour();

/* ---------- Diamond budget ---------- */
let goals = load("goals", []);
function renderBudget() {
  const have = Math.max(0, num("b_have")), rate = Math.max(0, num("b_rate"));
  const total = goals.reduce((a, g) => a + g.cost, 0);
  const need = Math.max(0, total - have);
  $("b_out").innerHTML = goals.map((g, i) => `<div class="item"><div>${esc(g.name)}<br><small>${g.cost} diamonds</small></div><button class="x" data-del="${i}" aria-label="Delete">✕</button></div>`).join("") +
    `<div class="cards" style="grid-template-columns:repeat(3,1fr)"><div class="card"><b>${total}</b><span>Total goals</span></div><div class="card"><b>${need}</b><span>Aur chahiye</span></div><div class="card"><b>${(need / 100 * rate).toFixed(0)}</b><span>Approx cost</span></div></div>`;
}
["b_have", "b_rate"].forEach((id) => $(id).addEventListener("input", () => { save("b_" + id, $(id).value); renderBudget(); }));
["b_have", "b_rate"].forEach((id) => { const v = load("b_" + id, null); if (v !== null) $(id).value = v; });
$("b_add").onclick = () => {
  const name = $("b_name").value.trim().slice(0, 40), cost = Math.max(0, Math.floor(num("b_cost")));
  if (!name || !cost) return toast("Naam aur diamonds dono daalo");
  goals.push({ name, cost }); save("goals", goals); $("b_name").value = ""; $("b_cost").value = ""; renderBudget();
};
$("b_out").onclick = (e) => { const i = e.target.dataset.del; if (i !== undefined) { goals.splice(+i, 1); save("goals", goals); renderBudget(); } };
renderBudget();

/* ---------- Name generator ---------- */
const range = (start, base) => (c) => String.fromCodePoint(start + c.charCodeAt(0) - base);
const alphaMap = (up, low) => (s) => [...s].map((c) => /[A-Z]/.test(c) ? up(c) : /[a-z]/.test(c) ? low(c) : c).join("");
const SMALL_CAPS = { a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ" };
const STYLES = [
  alphaMap(range(0x1d4d0, 65), range(0x1d4ea, 97)),           // bold script
  alphaMap(range(0x1d56c, 65), range(0x1d586, 97)),           // bold fraktur
  alphaMap(range(0x1d5d4, 65), range(0x1d5ee, 97)),           // sans bold
  alphaMap(range(0x1d670, 65), range(0x1d68a, 97)),           // monospace
  alphaMap(range(0x24b6, 65), range(0x24d0, 97)),             // circled
  alphaMap(range(0xff21, 65), range(0xff41, 97)),             // fullwidth
  (s) => [...s.toLowerCase()].map((c) => SMALL_CAPS[c] || c).join(""),
];
const DECOR = [(s) => `꧁${s}꧂`, (s) => `༒${s}༒`, (s) => `☠ ${s} ☠`, (s) => `『${s}』`, (s) => `⚡${s}⚡`];
function renderNames() {
  const src = $("n_in").value.trim();
  if (!src) { $("n_out").innerHTML = ""; return; }
  const out = [];
  STYLES.forEach((f, i) => { const s = f(src); out.push(s); out.push(DECOR[i % DECOR.length](s)); });
  $("n_out").innerHTML = out.map((s, i) => `<div class="name"><span>${esc(s)}</span><button class="btn small ghost" data-copy="${i}">Copy</button></div>`).join("");
  $("n_out")._list = out;
}
$("n_in").oninput = renderNames;
$("n_out").onclick = (e) => { const i = e.target.dataset.copy; if (i !== undefined) copy($("n_out")._list[+i]); };

/* ---------- Redeem codes ---------- */
let codes = load("codes", []);
function renderCodes() {
  const today = new Date().toISOString().slice(0, 10);
  $("r_list").innerHTML = codes.map((c, i) => {
    const exp = c.exp && c.exp < today;
    return `<div class="item"><div style="${c.used || exp ? "opacity:.5" : ""}"><b>${esc(c.code)}</b><br><small>${c.used ? "Used" : exp ? "Expired" : c.exp ? "Expires " + esc(c.exp) : "No expiry set"}</small></div>
      <div class="row" style="margin:0"><button class="btn small ghost" data-copy="${i}">Copy</button><button class="btn small ghost" data-use="${i}">${c.used ? "Undo" : "Used"}</button><button class="x" data-del="${i}" aria-label="Delete">✕</button></div></div>`;
  }).join("") || '<p class="hint">Koi code save nahi hai.</p>';
}
$("r_add").onclick = () => {
  const code = $("r_code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(code)) return toast("Code sirf letters/numbers (6-20) hona chahiye");
  codes.push({ code, exp: $("r_exp").value, used: false }); save("codes", codes);
  $("r_code").value = ""; $("r_exp").value = ""; renderCodes();
};
$("r_list").onclick = (e) => {
  const d = e.target.dataset;
  if (d.del !== undefined) codes.splice(+d.del, 1);
  else if (d.use !== undefined) codes[+d.use].used = !codes[+d.use].used;
  else if (d.copy !== undefined) return copy(codes[+d.copy].code);
  else return;
  save("codes", codes); renderCodes();
};
renderCodes();

/* ---------- PWA ---------- */
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("installBtn").hidden = true; };
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
