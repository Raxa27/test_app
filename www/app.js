"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (id) => parseFloat($(id).value) || 0;
const radio = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;
const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { toast("Couldn't save: storage is full or blocked", false); }
  if (window.FFAuth) window.FFAuth.onSave(key);
}
let toastTimer;
function toast(msg, ok = true) {
  const t = $("toast");
  t.innerHTML = (ok ? icon("check") : "") + esc(msg);
  t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
}
async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
    if (btn) { btn.classList.add("done"); btn.innerHTML = icon("check"); setTimeout(() => { btn.classList.remove("done"); btn.innerHTML = icon("copy"); }, 1400); }
  } catch { toast("Copy failed. Select the text and copy it manually.", false); }
}

/* Animated number: counts from the previous value to the new one. */
function countUp(el, to, decimals = 0) {
  const from = parseFloat(el.dataset.v || "0");
  el.dataset.v = to;
  if (reduceMotion || from === to) { el.textContent = to.toFixed(decimals); return; }
  const t0 = performance.now(), dur = 700;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = (from + (to - from) * e).toFixed(decimals);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/* Bars are rendered at 0 width and grown on the next frame so the transition plays. */
function growBars(root) {
  requestAnimationFrame(() => requestAnimationFrame(() =>
    root.querySelectorAll(".bar i[data-w]").forEach((i) => { i.style.width = i.dataset.w + "%"; })));
}
const bar = (pct, cls = "") => `<div class="bar ${cls}"><i data-w="${clamp(pct, 0, 100).toFixed(1)}"></i></div>`;
/* Destructive actions need a second tap within 3s (native confirm() is blocked in some webviews). */
function confirmTap(btn, msg) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.classList.remove("armed"); return true; }
  btn.dataset.armed = "1"; btn.classList.add("armed"); toast(msg, false);
  setTimeout(() => { delete btn.dataset.armed; btn.classList.remove("armed"); }, 3000);
  return false;
}
function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

/* Button ripple */
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".btn");
  if (!b || reduceMotion) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
  const span = document.createElement("span");
  span.className = "ripple";
  span.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(span); setTimeout(() => span.remove(), 650);
});

/* Range sliders: live value label + filled track */
function syncRange(el, fmt) {
  const p = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.setProperty("--p", p + "%");
  const out = $(el.id + "_v"); if (out) out.textContent = fmt(el.value);
}

/* ---------- Tools & routing ---------- */
const TOOLS = [
  { id: "sens", name: "Sensitivity", sub: "Settings tuned to your device and playstyle", color: "#ff8a1f" },
  { id: "dmg", name: "Damage Calculator", sub: "Headshot and body damage, shots to kill, TTK", color: "#f87171" },
  { id: "cmp", name: "Weapon Compare", sub: "Any two guns, stat by stat", color: "#60a5fa" },
  { id: "chars", name: "Character Combo", sub: "Best skills and pet for your role", color: "#a78bfa" },
  { id: "stats", name: "Match Stats", sub: "Kills, K/D, Booyah rate and progress", color: "#34d399" },
  { id: "tour", name: "Tournament", sub: "Points table for custom rooms", color: "#ffbe2e" },
  { id: "budget", name: "Diamond Planner", sub: "Plan your diamond goals and top-ups", color: "#22d3ee" },
  { id: "names", name: "Stylish Names", sub: "Nicknames with fancy fonts and symbols", color: "#f472b6" },
  { id: "codes", name: "Redeem Codes", sub: "Save codes and track expiry", color: "#fb923c" },
];
$("toolGrid").innerHTML = TOOLS.map((t, i) => `
  <a class="tool" href="#${t.id}" style="--tc:${t.color};--i:${i}">
    <span class="ico">${icon(t.id)}</span>
    <span class="go">${icon("arrow")}</span>
    <h4>${t.name}</h4><p>${t.sub}</p>
  </a>`).join("");
$("sideNav").innerHTML = `<a class="nav-link" href="#home" data-id="home"><span class="ico">${icon("home")}</span>Home</a>` +
  TOOLS.map((t) => `<a class="nav-link" href="#${t.id}" data-id="${t.id}" style="--tc:${t.color}"><span class="ico">${icon(t.id)}</span>${t.name}</a>`).join("") +
  `<a class="nav-link nav-account" href="#account" data-id="account"><span class="ico">${icon("user")}</span>Account</a>`;
const PAGES = { login: { name: "Log in", sub: "Sync your data across devices" }, account: { name: "Account", sub: "Profile and cloud sync" } };

const onShow = {};
function route() {
  const id = (location.hash.slice(1) || "home");
  const page = $(id) && $(id).classList.contains("page") ? id : "home";
  if (window.FFAuth && window.FFAuth.gate(page)) return;
  const tool = TOOLS.find((t) => t.id === page) || PAGES[page];
  document.querySelectorAll(".page").forEach((p) => {
    p.classList.remove("active");
    if (p.id === page) {
      [...p.children].forEach((c, i) => c.style.setProperty("--i", i));
      void p.offsetWidth; p.classList.add("active");
    }
  });
  document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.id === page));
  document.body.dataset.page = page;
  $("pageTitle").textContent = tool ? tool.name : "Dashboard";
  $("pageSub").textContent = tool ? tool.sub : "All your Free Fire tools";
  document.title = tool ? `${tool.name} · FF Toolkit` : "FF Toolkit";
  window.scrollTo(0, 0);
  if (onShow[page]) onShow[page]();
}
window.addEventListener("hashchange", route);

/* ---------- Sensitivity ---------- */
const SENS_BASE = {
  //          General RedDot 2x  4x  AWM FreeLook
  rusher:   [95, 90, 85, 80, 60, 70],
  balanced: [85, 80, 75, 70, 50, 60],
  sniper:   [75, 70, 70, 65, 45, 55],
};
const SENS_LABELS = ["General", "Red Dot", "2x Scope", "4x Scope", "AWM Scope", "Free Look"];
let sensVals = [];
function renderSens(first) {
  syncRange($("s_size"), (v) => (+v).toFixed(1) + '"');
  syncRange($("s_ram"), (v) => v + " GB");
  const size = num("s_size"), ram = num("s_ram"), claw = +radio("s_claw");
  let f = 1 + (size - 6.5) * 0.03;   // bigger screen -> slightly higher
  if (ram <= 3) f -= 0.05;           // low-end device: easier control
  f += (claw - 3) * 0.02;            // more fingers -> slightly higher
  sensVals = SENS_BASE[radio("s_style")].map((v) => clamp(Math.round(v * f), 1, 100));
  const out = $("s_out");
  if (first || !out.children.length) {
    out.innerHTML = SENS_LABELS.map((l, i) => `<div class="sens-row" style="--i:${i}"><span>${l}</span>${bar(0)}<b>0</b></div>`).join("");
  }
  [...out.children].forEach((row, i) => {
    row.querySelector(".bar i").dataset.w = sensVals[i];
    countUp(row.querySelector("b"), sensVals[i]);
  });
  growBars(out);
}
document.querySelectorAll("#sens input").forEach((el) => el.addEventListener("input", () => renderSens()));
$("s_copy").onclick = (e) => copy(SENS_LABELS.map((l, i) => `${l}: ${sensVals[i]}`).join("\n"));
onShow.sens = () => renderSens(true);

/* ---------- Weapons ---------- */
// Approximate, editable values: [name, category, damage per hit, rounds/sec, magazine, headshot multiplier, effective range (m)]
const CATS = ["SMG", "AR", "Shotgun", "Marksman", "Sniper", "LMG", "Pistol"];
const DEFAULT_WEAPONS = [
  ["MP40", "SMG", 18, 14, 20, 1.8, 30], ["UMP", "SMG", 22, 9, 30, 1.8, 40], ["MP5", "SMG", 20, 11, 30, 1.8, 35],
  ["Thompson", "SMG", 21, 10, 30, 1.8, 35], ["Vector", "SMG", 16, 16, 30, 1.8, 25], ["P90", "SMG", 17, 12, 50, 1.8, 35],
  ["Bizon", "SMG", 18, 11, 40, 1.8, 35], ["MAC10", "SMG", 17, 14, 25, 1.8, 25],
  ["M4A1", "AR", 24, 8, 30, 1.8, 55], ["AK47", "AR", 30, 6.5, 30, 1.8, 55], ["SCAR", "AR", 22, 8.5, 30, 1.8, 55],
  ["Groza", "AR", 34, 8, 30, 1.8, 60], ["FAMAS", "AR", 25, 9, 30, 1.8, 50], ["AN94", "AR", 28, 8, 30, 1.8, 55],
  ["XM8", "AR", 24, 8.5, 30, 1.8, 60], ["AUG", "AR", 25, 8, 30, 1.8, 60], ["Parafal", "AR", 33, 6, 30, 1.8, 60],
  ["G36", "AR", 26, 8, 30, 1.8, 55], ["Kingfisher", "AR", 26, 8.5, 30, 1.8, 55],
  ["M1887", "Shotgun", 70, 1.2, 2, 1.5, 12], ["M1014", "Shotgun", 60, 1.4, 6, 1.5, 12], ["SPAS12", "Shotgun", 65, 1.1, 5, 1.5, 12],
  ["MAG-7", "Shotgun", 55, 1.6, 8, 1.5, 12], ["M590", "Shotgun", 62, 1.3, 6, 1.5, 12],
  ["Woodpecker", "Marksman", 52, 2, 12, 1.8, 90], ["SKS", "Marksman", 45, 2.5, 10, 2, 90], ["SVD", "Marksman", 50, 2.2, 10, 2, 100],
  ["VSS", "Marksman", 30, 5, 20, 2, 70], ["M14", "Marksman", 40, 3, 20, 1.9, 80],
  ["AWM", "Sniper", 110, 0.5, 5, 2.5, 150], ["M82B", "Sniper", 90, 0.6, 5, 2.5, 150], ["Kar98k", "Sniper", 95, 0.6, 5, 2.5, 140],
  ["M24", "Sniper", 100, 0.55, 5, 2.5, 140],
  ["M249", "LMG", 30, 8, 100, 1.8, 60], ["M60", "LMG", 27, 10, 60, 1.8, 55], ["Kord", "LMG", 33, 9, 100, 1.8, 60],
  ["Desert Eagle", "Pistol", 50, 2.5, 7, 2, 30], ["M500", "Pistol", 60, 1.5, 5, 2, 30], ["USP", "Pistol", 22, 4, 12, 1.8, 25],
  ["G18", "Pistol", 16, 12, 15, 1.8, 20], ["M1917", "Pistol", 55, 1.5, 6, 2, 30],
];
const W = { name: 0, cat: 1, damage: 2, rate: 3, mag: 4, hs: 5, range: 6 };
const clone = (x) => JSON.parse(JSON.stringify(x));
let weapons = load("weapons_v2", clone(DEFAULT_WEAPONS));
function weaponOptions() {
  return CATS.map((c) => {
    const opts = weapons.map((w, i) => w[W.cat] === c ? `<option value="${i}">${esc(w[W.name])}</option>` : "").join("");
    return opts ? `<optgroup label="${c}">${opts}</optgroup>` : "";
  }).join("");
}
function fillWeaponSelects() {
  const defaults = { d_weapon: "M1887", c_a: "MP40", c_b: "UMP" };
  ["d_weapon", "c_a", "c_b"].forEach((id) => {
    const el = $(id), cur = el.value;
    el.innerHTML = weaponOptions();
    if (cur && weapons[cur]) el.value = cur;
    else { const i = weapons.findIndex((w) => w[W.name] === defaults[id]); el.value = String(i >= 0 ? i : 0); }
  });
}
const ARMOR = [1, 0.9, 0.8, 0.7]; // damage multiplier per armor level (approximate)
function distFactor(w, d) {
  if (d <= w[W.range]) return 1;
  return clamp(1 - 0.5 * ((d - w[W.range]) / w[W.range]), 0.5, 1);
}
function renderDmg() {
  syncRange($("d_dist"), (v) => v + " m");
  const w = weapons[+$("d_weapon").value];
  if (!w) return;
  const d = num("d_dist"), hp = Math.max(1, num("d_hp"));
  const f = distFactor(w, d);
  const card = (label, dot, dmg) => {
    const shots = Math.ceil(hp / dmg);
    const ttk = shots <= 1 ? 0 : (shots - 1) / w[W.rate];
    const ok = shots <= w[W.mag];
    return `<div class="dmg-card" style="--dot:${dot}">
      <span class="tag">${label}</span>
      <div class="val">${shots}</div><div class="sub">shots to kill</div>
      <dl><dt>Per hit</dt><dd>${dmg.toFixed(1)}</dd><dt>TTK</dt><dd>${ttk.toFixed(2)}s</dd><dt>Magazine</dt>
      <dd><span class="pill ${ok ? "ok" : "bad"}">${ok ? "One mag is enough" : "Needs a reload"}</span></dd></dl>
    </div>`;
  };
  $("d_out").innerHTML = `<div class="dmg-grid">
      ${card("Headshot", "var(--accent)", w[W.damage] * w[W.hs] * f * ARMOR[+radio("d_helm")])}
      ${card("Body", "var(--info)", w[W.damage] * f * ARMOR[+radio("d_vest")])}
    </div>
    <div class="falloff">${esc(w[W.name])} · ${w[W.cat]} · effective range ${w[W.range]}m${f < 1 ? ` · <span class="pill bad">−${Math.round((1 - f) * 100)}% range falloff</span>` : ` · <span class="pill ok">Full damage</span>`}</div>`;
}
document.querySelectorAll("#dmg input, #dmg select").forEach((el) => el.addEventListener("input", renderDmg));

function renderCompare() {
  const a = weapons[+$("c_a").value], b = weapons[+$("c_b").value];
  if (!a || !b) { $("c_out").innerHTML = ""; return; }
  const dps = (w) => Math.round(w[W.damage] * w[W.rate]);
  const stats = [["Damage", (w) => w[W.damage]], ["Fire rate", (w) => w[W.rate]], ["Magazine", (w) => w[W.mag]],
    ["Headshot ×", (w) => w[W.hs]], ["Range", (w) => w[W.range]], ["DPS", dps]];
  let scoreA = 0, scoreB = 0;
  const rows = stats.map(([l, fn], i) => {
    const va = fn(a), vb = fn(b), mx = Math.max(va, vb) || 1;
    if (va > vb) scoreA++; else if (vb > va) scoreB++;
    return `<div class="cmp-row" style="--i:${i}">
      <div class="cmp-side a ${va > vb ? "win" : ""}"><b>${va}</b>${bar((va / mx) * 100)}</div>
      <div class="lbl">${l}</div>
      <div class="cmp-side ${vb > va ? "win" : ""}"><b>${vb}</b>${bar((vb / mx) * 100, "b")}</div></div>`;
  }).join("");
  const winner = scoreA === scoreB ? "It's a tie. Pick the one that suits your playstyle."
    : `<b>${esc((scoreA > scoreB ? a : b)[W.name])}</b> wins ${Math.max(scoreA, scoreB)} of ${stats.length} stats.`;
  $("c_out").innerHTML = `<div class="cmp-head"><div class="a"><span class="pill gold">${a[W.cat]}</span><b>${esc(a[W.name])}</b></div>
    <div class="b"><span class="pill info">${b[W.cat]}</span><b>${esc(b[W.name])}</b></div></div>${rows}<div class="verdict">${winner}</div>`;
  growBars($("c_out"));
}
function renderWeaponEditor() {
  $("c_edit").innerHTML = `<div class="edit-row"><b>Name</b><b>Type</b><b>Dmg</b><b>RPS</b><b>Mag</b><b>HS×</b><b>Range</b></div>` +
    weapons.map((w, i) => `<div class="edit-row">${w.map((v, j) => j === W.cat
      ? `<select data-i="${i}" data-j="${j}">${CATS.map((c) => `<option ${c === v ? "selected" : ""}>${c}</option>`).join("")}</select>`
      : `<input data-i="${i}" data-j="${j}" value="${esc(v)}" ${j ? 'type="number" step="any" inputmode="decimal"' : 'maxlength="20"'} aria-label="${esc(w[0])}">`).join("")}</div>`).join("");
}
$("c_edit").addEventListener("change", (e) => {
  const { i, j } = e.target.dataset;
  if (i === undefined) return;
  const k = +j;
  weapons[i][k] = k === W.name ? e.target.value.slice(0, 20) : k === W.cat ? e.target.value : Math.max(0.01, parseFloat(e.target.value) || 0.01);
  save("weapons_v2", weapons); fillWeaponSelects(); renderCompare(); renderDmg();
});
$("c_reset").onclick = () => {
  weapons = clone(DEFAULT_WEAPONS); save("weapons_v2", weapons);
  fillWeaponSelects(); renderWeaponEditor(); renderCompare(); renderDmg(); toast("Default values restored");
};
$("c_a").onchange = $("c_b").onchange = renderCompare;
fillWeaponSelects(); renderWeaponEditor();
onShow.dmg = renderDmg;
onShow.cmp = renderCompare;

/* ---------- Characters & pets ---------- */
// [name, type, ability description, roles]
const CHARS = [
  ["Alok", "Active", "Drop the Beat: a 5m aura that restores HP and boosts movement speed.", ["heal", "support", "mobility"]],
  ["Chrono", "Active", "Time Turner: a force field that blocks enemy damage, plus a speed boost.", ["rush", "defense"]],
  ["K", "Active", "Master of All: Jiu-jitsu mode boosts teammates' EP conversion; Psychology mode turns EP into HP.", ["heal", "support"]],
  ["Skyler", "Active", "Riptide Rhythm: a sonic wave that destroys gloo walls in front of you.", ["rush"]],
  ["Wukong", "Active", "Camouflage: turn into a bush to hide or set up an ambush.", ["defense", "rush"]],
  ["Steffie", "Active", "Painted Refuge: a graffiti zone that reduces throwable damage and repairs armor.", ["defense", "support"]],
  ["A124", "Active", "Thrill of Battle: disables nearby enemies' skills for a short time.", ["rush", "support"]],
  ["Dimitri", "Active", "Healing Heartbeat: creates a healing zone; knocked players inside can self-recover.", ["heal", "support"]],
  ["Tatsuya", "Active", "Rebel Rush: a quick forward dash.", ["rush", "mobility"]],
  ["Kenta", "Active", "Swordsman's Wrath: a shield wall in front of you that reduces incoming damage.", ["defense"]],
  ["Clu", "Active", "Tracing Steps: reveals the location of nearby enemies.", ["support", "snipe"]],
  ["Xayne", "Active", "Xtreme Encounter: temporary HP and extra damage to gloo walls and shields.", ["rush"]],
  ["Kelly", "Passive", "Dash: faster sprinting speed.", ["mobility"]],
  ["Hayato", "Passive", "Bushido: the lower your HP, the higher your armor penetration.", ["rush"]],
  ["Moco", "Passive", "Hacker's Eye: enemies you shoot are tagged for your team for a few seconds.", ["support", "rush", "snipe"]],
  ["Jota", "Passive", "Sustained Raids: recover HP when you knock down or eliminate an enemy.", ["heal", "rush"]],
  ["Dasha", "Passive", "Partying On: less recoil and less fall damage.", ["rush", "snipe"]],
  ["Shirou", "Passive", "Damage Delivered: enemies who hit you get marked, and your next shot on them gets extra armor penetration.", ["rush"]],
  ["Maxim", "Passive", "Gluttony: use medkits and mushrooms faster.", ["heal"]],
  ["Olivia", "Passive", "Healing Touch: teammates you revive get extra HP.", ["support", "heal"]],
  ["Ford", "Passive", "Iron Will: take less damage outside the safe zone.", ["mobility", "defense"]],
  ["Andrew", "Passive", "Armor Specialist: your vest loses durability more slowly.", ["defense"]],
  ["Kla", "Passive", "Muay Thai: stronger fist damage.", ["rush"]],
  ["Laura", "Passive", "Sharp Shooter: better accuracy while scoped in.", ["snipe"]],
  ["Rafael", "Passive", "Dead Silent: sniper and marksman shots are silenced.", ["snipe"]],
  ["Luqueta", "Passive", "Hat Trick: each kill raises your max HP.", ["rush", "heal"]],
  ["Thiva", "Passive", "Vital Vibes: revive teammates faster.", ["support"]],
  ["Miguel", "Passive", "Crazy Slayer: gain EP for each kill.", ["heal"]],
  ["Antonio", "Passive", "Gangster's Spirit: start each round with extra HP.", ["defense"]],
  ["Joseph", "Passive", "Nutty Movement: taking damage boosts your movement and sprint speed.", ["mobility"]],
  ["Nikita", "Passive", "Firearms Expert: faster SMG reloads.", ["rush"]],
];
const PETS = [
  ["Falco", "Pet", "Skyline Spree: faster gliding and skydiving for your squad.", ["mobility"]],
  ["Ottero", "Pet", "Double Blubber: using a medkit also gives you EP.", ["heal"]],
  ["Mr. Waggor", "Pet", "Smooth Gloo: produces gloo wall grenades over time.", ["defense"]],
  ["Detective Panda", "Pet", "Panda's Blessings: restore HP on each kill.", ["rush", "heal"]],
  ["Rockie", "Pet", "Stay Chill: shortens your active skill cooldown.", ["support"]],
  ["Beaston", "Pet", "Helping Hand: throw grenades and throwables farther.", ["support"]],
  ["Robo", "Pet", "Wall Enforcement: adds a shield to your gloo walls.", ["defense"]],
  ["Dreki", "Pet", "Dragon Glare: spots enemies who are using medkits.", ["snipe", "rush"]],
];
// Recommended loadout per role: 1 active + 3 passives + pet
const COMBOS = {
  rush: ["Chrono", "Hayato", "Jota", "Moco", "Detective Panda"],
  heal: ["Alok", "Jota", "Maxim", "Luqueta", "Ottero"],
  support: ["Dimitri", "Moco", "Olivia", "Thiva", "Rockie"],
  mobility: ["Tatsuya", "Kelly", "Joseph", "Ford", "Falco"],
  defense: ["Kenta", "Andrew", "Ford", "Antonio", "Mr. Waggor"],
  snipe: ["Clu", "Laura", "Rafael", "Moco", "Dreki"],
};
const ROLE_NAMES = { rush: "Rush", heal: "Sustain", support: "Support", mobility: "Rotation", defense: "Defense", snipe: "Sniper" };
const ALL = [...CHARS, ...PETS];
const hue = (name) => [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const avatar = (n) => `<span class="avatar" style="--h:${hue(n)}">${esc(n.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase())}</span>`;
const typePill = (t) => `<span class="pill ${t === "Active" ? "gold" : t === "Pet" ? "violet" : "info"}">${t}</span>`;
function renderChars() {
  const role = radio("ch_role"), q = ($("ch_q").value || "").trim().toLowerCase(), type = radio("ch_type");
  const slots = ["Active skill", "Passive 1", "Passive 2", "Passive 3", "Pet"];
  $("ch_best").innerHTML = `<div class="card-head"><h3 class="card-title">Best combo: ${ROLE_NAMES[role]}</h3></div><div class="combo">` +
    COMBOS[role].map((n, i) => `<div class="slot ${i === 0 ? "active-slot" : ""}" style="--i:${i}">${avatar(n)}<b>${esc(n)}</b><small>${slots[i]}</small></div>`).join("") + "</div>";
  const list = ALL.filter(([n, t, d, roles]) => (type === "all" || t === type) && (!q || n.toLowerCase().includes(q) || d.toLowerCase().includes(q)))
    .sort((x, y) => (y[3].includes(role) - x[3].includes(role)));
  $("ch_out").innerHTML = list.length ? list.map(([n, t, d, roles], i) => `<div class="char" style="--i:${Math.min(i, 20)}">${avatar(n)}
      <div><h4>${esc(n)} ${typePill(t)}${roles.includes(role) ? '<span class="pill ok">Match</span>' : ""}</h4><p>${esc(d)}</p></div></div>`).join("")
    : `<div class="empty card">${icon("chars")}No matches for that search</div>`;
}
(function setupChars() {
  // extra controls for the full roster
  $("ch_roles").insertAdjacentHTML("beforeend", `<label><input type="radio" name="ch_role" value="snipe"><span>Sniper</span></label>`);
  $("ch_out").insertAdjacentHTML("beforebegin", `<div class="card char-best" id="ch_best"></div>
    <div class="char-tools"><input id="ch_q" placeholder="Search characters or abilities…" type="search">
    <div class="chips">${["all", "Active", "Passive", "Pet"].map((t, i) => `<label><input type="radio" name="ch_type" value="${t}" ${i ? "" : "checked"}><span>${t === "all" ? "All" : t === "Pet" ? "Pets" : t}</span></label>`).join("")}</div></div>`);
  document.querySelectorAll("#chars input").forEach((el) => el.addEventListener("input", renderChars));
})();
onShow.chars = renderChars;

/* ---------- Match stats ---------- */
let matches = load("matches", []);
const cleanMatches = (data) => data.map((m) => ({ mode: String(m.mode || "BR").slice(0, 10), kills: Math.max(0, +m.kills || 0), dmg: Math.max(0, +m.dmg || 0), rank: Math.max(1, +m.rank || 1), date: String(m.date || "").slice(0, 40) }));
function statSummary() {
  const n = matches.length, kills = matches.reduce((a, m) => a + m.kills, 0);
  const wins = matches.filter((m) => m.rank === 1).length;
  return { n, wins, kills, winRate: n ? (wins / n) * 100 : 0, avg: n ? kills / n : 0, kd: n ? kills / Math.max(1, n - wins) : 0 }; // a non-win match ends with one death
}
function kpis(el, items) {
  if (el.children.length !== items.length) el.innerHTML = items.map(([l, , , hl]) => `<div class="kpi ${hl ? "hl" : ""}"><b>0</b><span>${l}</span></div>`).join("");
  items.forEach(([, v, dec], i) => countUp(el.children[i].querySelector("b"), v, dec));
}
function renderStats() {
  const s = statSummary();
  kpis($("m_sum"), [["Matches", s.n, 0], ["Booyah %", s.winRate, 0, true], ["Avg kills", s.avg, 1], ["K/D", s.kd, 2, true]]);
  const last = matches.slice(-10);
  if (last.length) {
    const mx = Math.max(4, ...last.map((m) => m.kills)), W_ = 320, H = 150, bw = W_ / 10, base = H - 18;
    const grid = [0.25, 0.5, 0.75, 1].map((p) => `<line x1="0" x2="${W_}" y1="${base - p * 110}" y2="${base - p * 110}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3 4"/>`).join("");
    $("m_chart").innerHTML = `<svg class="chart" viewBox="0 0 ${W_} ${H}" role="img" aria-label="Last matches kills">${grid}` + last.map((m, i) => {
      const h = Math.max(3, (m.kills / mx) * 110), x = i * bw + 6;
      const fill = m.rank === 1 ? "url(#g-win)" : "url(#g-accent)";
      return `<rect class="col" style="--i:${i}" x="${x}" y="${base - h}" width="${bw - 12}" height="${h}" rx="5" fill="${fill}"/>
        <text x="${x + (bw - 12) / 2}" y="${base - h - 6}" font-size="11" fill="#eef1f7" text-anchor="middle">${m.kills}</text>
        <text x="${x + (bw - 12) / 2}" y="${H - 4}" font-size="9" fill="#5d6578" text-anchor="middle">#${matches.length - last.length + i + 1}</text>`;
    }).join("") + `<defs><linearGradient id="g-win" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#059669"/><stop offset="1" stop-color="#34d399"/></linearGradient></defs></svg>
      <p class="note"><span class="pill gold">Orange</span> normal match · <span class="pill ok">Green</span> Booyah</p>`;
  } else $("m_chart").innerHTML = `<div class="empty">${icon("stats")}Save your first match to see the graph here</div>`;
  $("m_list").innerHTML = matches.length ? matches.slice(-15).reverse().map((m, i) => {
    const idx = matches.indexOf(m), cls = m.rank === 1 ? "gold" : m.rank === 2 ? "silver" : m.rank === 3 ? "bronze" : "";
    return `<div class="item" style="--i:${i}"><span class="badge ${cls}">#${m.rank}</span>
      <div class="grow"><div class="title">${m.kills} kills · ${m.dmg} dmg <span class="pill mute">${esc(m.mode)}</span>${m.rank === 1 ? '<span class="pill gold">Booyah!</span>' : ""}</div>
      <div class="meta">${esc(m.date)}</div></div>
      <button class="icon-btn danger" data-del="${idx}" aria-label="Delete">${icon("trash")}</button></div>`;
  }).join("") : `<div class="empty">${icon("stats")}No matches saved yet</div>`;
}
$("m_add").onclick = () => {
  matches.push({ mode: radio("m_mode"), kills: Math.max(0, Math.floor(num("m_kills"))), dmg: Math.max(0, Math.floor(num("m_dmg"))), rank: Math.max(1, Math.floor(num("m_rank"))), date: new Date().toLocaleString() });
  save("matches", matches); renderStats(); toast(matches.at(-1).rank === 1 ? "Booyah! Match saved" : "Match saved");
};
$("m_list").onclick = (e) => { const b = e.target.closest("[data-del]"); if (b) { matches.splice(+b.dataset.del, 1); save("matches", matches); renderStats(); } };
$("m_clear").onclick = (e) => { if (matches.length && confirmTap(e.currentTarget, "Tap again to delete all matches")) { matches = []; save("matches", matches); renderStats(); } };
$("m_export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(matches, null, 2)], { type: "application/json" }));
  a.download = "ff-matches.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("m_import").onchange = async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data)) throw 0;
    matches = cleanMatches(data);
    save("matches", matches); renderStats(); toast(`Imported ${matches.length} matches`);
  } catch { toast("That file isn't a valid match export", false); }
  e.target.value = "";
};
onShow.stats = renderStats;

/* ---------- Tournament ---------- */
const PLACE_PTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
let tour = load("tour", { teams: [] }); // teams: {name, results:[{place,kills}]}
const teamPts = (t) => t.results.reduce((a, r) => a + (PLACE_PTS[r.place - 1] || 0) + r.kills, 0);
function renderTour() {
  const sel = $("t_sel"), cur = sel.value;
  sel.innerHTML = tour.teams.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join("");
  if (tour.teams[cur]) sel.value = cur;
  const rows = tour.teams.map((t) => ({ t, pts: teamPts(t), kills: t.results.reduce((a, r) => a + r.kills, 0), wins: t.results.filter((r) => r.place === 1).length }))
    .sort((a, b) => b.pts - a.pts || b.kills - a.kills);
  const medal = ["gold", "silver", "bronze"];
  $("t_table").innerHTML = rows.length ? `<table class="lb"><tr><th>#</th><th>Team</th><th>M</th><th>Booyah</th><th>Kills</th><th>Pts</th></tr>${rows.map((r, i) =>
    `<tr style="--i:${i}"><td><span class="badge ${medal[i] || ""}">${i + 1}</span></td><td>${esc(r.t.name)}</td><td>${r.t.results.length}</td><td>${r.wins}</td><td>${r.kills}</td><td>${r.pts}</td></tr>`).join("")}</table>`
    : `<div class="empty">${icon("tour")}Add teams to start the leaderboard</div>`;
}
$("t_add_team").onclick = () => {
  const name = $("t_team").value.trim().slice(0, 24);
  if (!name) return toast("Enter a team name", false);
  if (tour.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) return toast("That team is already added", false);
  tour.teams.push({ name, results: [] }); $("t_team").value = ""; save("tour", tour); renderTour();
  $("t_sel").value = String(tour.teams.length - 1); toast(`${name} added`);
};
$("t_team").addEventListener("keydown", (e) => { if (e.key === "Enter") $("t_add_team").click(); });
$("t_add_res").onclick = () => {
  const t = tour.teams[+$("t_sel").value];
  if (!t) return toast("Add a team first", false);
  t.results.push({ place: Math.max(1, Math.floor(num("t_place"))), kills: Math.max(0, Math.floor(num("t_kills"))) });
  save("tour", tour); renderTour(); toast(`Result added for ${t.name}`);
};
$("t_clear").onclick = (e) => { if (tour.teams.length && confirmTap(e.currentTarget, "Tap again to reset the tournament")) { tour = { teams: [] }; save("tour", tour); renderTour(); } };
onShow.tour = renderTour;

/* ---------- Diamond budget ---------- */
let goals = load("goals", []);
function renderBudget() {
  const have = Math.max(0, num("b_have")), rate = Math.max(0, num("b_rate"));
  const total = goals.reduce((a, g) => a + g.cost, 0), need = Math.max(0, total - have);
  const pct = total ? Math.min(100, (have / total) * 100) : 0;
  if (!$("b_ring")) {
    $("b_sum").innerHTML = `<div class="progress-ring"><div class="ring" id="b_ring"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/><circle class="val" cx="50" cy="50" r="42"/></svg><b><span id="b_pct">0</span>%</b></div>
      <div class="ring-info"><div>Total goals: <b id="b_total">0</b> 💎</div><div>Still needed: <b id="b_need">0</b> 💎</div><div>Approx cost: <b id="b_cost_v">0</b></div></div></div>`;
  }
  requestAnimationFrame(() => { $("b_ring").querySelector(".val").style.strokeDashoffset = 264 - (264 * pct) / 100; });
  countUp($("b_pct"), pct); countUp($("b_total"), total); countUp($("b_need"), need); countUp($("b_cost_v"), (need / 100) * rate);
  let running = have;
  $("b_out").innerHTML = goals.length ? goals.map((g, i) => {
    const ok = running >= g.cost; running -= g.cost;
    return `<div class="item" style="--i:${i}"><span class="badge">💎</span><div class="grow"><div class="title">${esc(g.name)} ${ok ? '<span class="pill ok">Affordable</span>' : '<span class="pill mute">Pending</span>'}</div>
      <div class="meta">${g.cost.toLocaleString()} diamonds</div></div><button class="icon-btn danger" data-del="${i}" aria-label="Delete">${icon("trash")}</button></div>`;
  }).join("") : `<div class="empty">${icon("budget")}No goals yet. Add one above.</div>`;
}
["b_have", "b_rate"].forEach((id) => {
  const v = load("b_" + id, null); if (v !== null) $(id).value = v;
  $(id).addEventListener("input", () => { save("b_" + id, $(id).value); renderBudget(); });
});
$("b_add").onclick = () => {
  const name = $("b_name").value.trim().slice(0, 40), cost = Math.max(0, Math.floor(num("b_cost")));
  if (!name || !cost) return toast("Enter both a goal name and a diamond amount", false);
  goals.push({ name, cost }); save("goals", goals); $("b_name").value = ""; $("b_cost").value = ""; renderBudget(); toast("Goal added");
};
$("b_out").onclick = (e) => { const b = e.target.closest("[data-del]"); if (b) { goals.splice(+b.dataset.del, 1); save("goals", goals); renderBudget(); } };
onShow.budget = renderBudget;

/* ---------- Name generator ---------- */
const range = (start, base) => (c) => String.fromCodePoint(start + c.charCodeAt(0) - base);
const alphaMap = (up, low) => (s) => [...s].map((c) => /[A-Z]/.test(c) ? up(c) : /[a-z]/.test(c) ? low(c) : c).join("");
const SMALL_CAPS = { a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ" };
const STYLES = [
  alphaMap(range(0x1d4d0, 65), range(0x1d4ea, 97)),   // bold script
  alphaMap(range(0x1d56c, 65), range(0x1d586, 97)),   // bold fraktur
  alphaMap(range(0x1d5d4, 65), range(0x1d5ee, 97)),   // sans bold
  alphaMap(range(0x1d468, 65), range(0x1d482, 97)),   // serif bold italic
  alphaMap(range(0x1d670, 65), range(0x1d68a, 97)),   // monospace
  alphaMap(range(0x24b6, 65), range(0x24d0, 97)),     // circled
  alphaMap(range(0xff21, 65), range(0xff41, 97)),     // fullwidth
  (s) => [...s.toLowerCase()].map((c) => SMALL_CAPS[c] || c).join(""),
];
const DECOR = [(s) => `꧁${s}꧂`, (s) => `༒${s}༒`, (s) => `☠ ${s} ☠`, (s) => `『${s}』`, (s) => `⚡${s}⚡`, (s) => `★彡${s}彡★`, (s) => `×͜×${s}`, (s) => `ᴳᵒᵈ ${s}`];
let nameList = [];
function renderNames() {
  const src = $("n_in").value.trim() || "Player";
  nameList = [];
  STYLES.forEach((f, i) => { const s = f(src); nameList.push(s, DECOR[i % DECOR.length](s)); });
  $("n_out").innerHTML = nameList.map((s, i) => `<div class="name" style="--i:${i}"><span>${esc(s)}</span><button class="icon-btn" data-copy="${i}" aria-label="Copy">${icon("copy")}</button></div>`).join("");
}
$("n_in").oninput = renderNames;
$("n_out").onclick = (e) => { const b = e.target.closest("[data-copy]"); if (b) copy(nameList[+b.dataset.copy], b); };
onShow.names = renderNames;

/* ---------- Redeem codes ---------- */
let codes = load("codes", []);
function renderCodes() {
  const today = new Date().toISOString().slice(0, 10);
  $("r_list").innerHTML = codes.length ? codes.map((c, i) => {
    const exp = c.exp && c.exp < today;
    const status = c.used ? '<span class="pill mute">Used</span>' : exp ? '<span class="pill bad">Expired</span>' : '<span class="pill ok">Active</span>';
    return `<div class="item ${c.used || exp ? "dim" : ""}" style="--i:${i}"><span class="badge">${icon("codes")}</span>
      <div class="grow"><div class="title"><span style="font-family:var(--display);letter-spacing:1px">${esc(c.code)}</span> ${status}</div>
      <div class="meta">${c.exp ? (exp ? "Expired " : "Expires ") + esc(c.exp) : "No expiry date"}</div></div>
      <div class="actions"><button class="icon-btn" data-copy="${i}" aria-label="Copy">${icon("copy")}</button>
      <button class="icon-btn" data-use="${i}" aria-label="${c.used ? "Mark unused" : "Mark used"}">${icon(c.used ? "undo" : "check")}</button>
      <button class="icon-btn danger" data-del="${i}" aria-label="Delete">${icon("trash")}</button></div></div>`;
  }).join("") : `<div class="empty">${icon("codes")}No codes saved yet</div>`;
}
$("r_add").onclick = () => {
  const code = $("r_code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(code)) return toast("Codes are 6–20 letters or numbers", false);
  if (codes.some((c) => c.code === code)) return toast("That code is already saved", false);
  codes.unshift({ code, exp: $("r_exp").value, used: false }); save("codes", codes);
  $("r_code").value = ""; $("r_exp").value = ""; renderCodes(); toast("Code saved");
};
$("r_list").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.copy !== undefined) return copy(codes[+d.copy].code, b);
  if (d.del !== undefined) codes.splice(+d.del, 1);
  else if (d.use !== undefined) codes[+d.use].used = !codes[+d.use].used;
  else return;
  save("codes", codes); renderCodes();
};
onShow.codes = renderCodes;

/* ---------- Home ---------- */
onShow.home = () => {
  const s = statSummary(), today = new Date().toISOString().slice(0, 10);
  const active = codes.filter((c) => !c.used && !(c.exp && c.exp < today)).length;
  kpis($("homeStats"), [["Matches", s.n, 0], ["K/D", s.kd, 2, true], ["Active codes", active, 0]]);
};

/* ---------- State API used by auth.js for cloud sync ---------- */
const SYNC_KEYS = ["matches", "tour", "goals", "codes", "weapons_v2", "b_b_have", "b_b_rate"];
window.FF = {
  route, toast,
  isGuest: () => load("guest", false),
  setGuest: (v) => { try { localStorage.setItem("guest", JSON.stringify(!!v)); } catch {} },
  exportState: () => ({ matches, tour, goals, codes, weapons: weapons, b_have: $("b_have").value, b_rate: $("b_rate").value }),
  hasData: (d) => !!d && ["matches", "goals", "codes"].some((k) => Array.isArray(d[k]) && d[k].length) || !!(d && d.tour && d.tour.teams && d.tour.teams.length),
  importState(d) {
    if (Array.isArray(d.matches)) { matches = cleanMatches(d.matches); save("matches", matches); }
    if (d.tour && Array.isArray(d.tour.teams)) { tour = d.tour; save("tour", tour); }
    if (Array.isArray(d.goals)) { goals = d.goals.filter((g) => g && g.name).map((g) => ({ name: String(g.name).slice(0, 40), cost: Math.max(0, +g.cost || 0) })); save("goals", goals); }
    if (Array.isArray(d.codes)) { codes = d.codes.filter((c) => c && c.code).map((c) => ({ code: String(c.code).slice(0, 20), exp: String(c.exp || ""), used: !!c.used })); save("codes", codes); }
    if (Array.isArray(d.weapons) && d.weapons.length) { weapons = d.weapons; save("weapons_v2", weapons); }
    if (d.b_have != null) { $("b_have").value = d.b_have; save("b_b_have", d.b_have); }
    if (d.b_rate != null) { $("b_rate").value = d.b_rate; save("b_b_rate", d.b_rate); }
    fillWeaponSelects(); renderWeaponEditor(); route();
  },
  clearLocal() {
    SYNC_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    matches = []; tour = { teams: [] }; goals = []; codes = []; weapons = clone(DEFAULT_WEAPONS);
    $("b_have").value = 0; $("b_rate").value = 80;
    fillWeaponSelects(); renderWeaponEditor(); route();
  },
};

/* ---------- PWA ---------- */
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("installBtn").hidden = true; };
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

route();
