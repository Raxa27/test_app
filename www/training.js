"use strict";
/* Training games: Drag Headshot, Tracking, Tap Speed, Peek Reflex, Spot the Enemy. Runs after app.js and uses its helpers. */

/* Shared shell: HUD + arena + start/result overlay */
function gameShell(id, { title, desc, arenaClass = "", note }) {
  $(id).innerHTML = `
    <div class="kpis kpis-4" id="${id}_hud"></div>
    <div class="card arena-card">
      <div id="${id}_arena" class="arena ${arenaClass}" aria-label="${title} arena">
        <div class="arena-msg" id="${id}_msg"><b>${title}</b><p>${desc}</p><button class="btn" type="button" data-start>Start</button></div>
      </div>
    </div>
    <p class="note">${note}</p>`;
}
function gameResult(id, headline, detail, start) {
  const m = $(id + "_msg");
  m.innerHTML = `<b>${headline}</b><p>${detail}</p><button class="btn" type="button" data-start>Play again</button>`;
  m.hidden = false;
  m.querySelector("[data-start]").onclick = start;
}
function popText(arena, x, y, text, cls) {
  const el = document.createElement("span");
  el.className = "pop-text " + cls; el.textContent = text;
  el.style.left = x + "px"; el.style.top = y + "px";
  arena.appendChild(el); setTimeout(() => el.remove(), 700);
}
const avgOf = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/* ---------- Drag Headshot ---------- */
// Press on the enemy's body, drag up, release on the head. Like the in-game drag shot.
(function () {
  const ID = "drag", REPS = 20;
  gameShell(ID, { title: "Drag headshot drill", desc: "Press on the enemy's body, drag up and let go on the head. 20 enemies.",
    note: "From enemy 6 onward they strafe. Best headshot rate is saved." });
  const arena = $(ID + "_arena");
  let g = null;
  const hud = () => {
    const shots = g ? g.hs + g.body + g.miss : 0;
    kpis($(ID + "_hud"), [["Enemy", g ? Math.min(g.i + 1, REPS) : 0, 0], ["Headshots", g ? g.hs : 0, 0, true], ["Headshot %", shots ? (g.hs / shots) * 100 : 0, 0], ["Best %", load("drag_best", 0), 0, true]]);
  };
  function spawn() {
    arena.querySelectorAll(".enemy,.xhair").forEach((e) => e.remove());
    const r = arena.getBoundingClientRect(), en = document.createElement("div");
    en.className = "enemy" + (g.i >= 5 ? " strafe" : "");
    en.innerHTML = `<span class="e-head"></span><span class="e-body"></span>`;
    en.style.left = 20 + Math.random() * (r.width - 100) + "px";
    en.style.top = r.height * 0.35 + Math.random() * (r.height * 0.4) + "px";
    arena.appendChild(en); g.en = en;
  }
  const inside = (rect, x, y, pad = 0) => x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
  arena.addEventListener("pointerdown", (e) => {
    if (!g || !g.en || g.lock) return;
    const body = g.en.querySelector(".e-body").getBoundingClientRect();
    if (!inside(body, e.clientX, e.clientY, 10)) { toast("Start your drag on the enemy's body", false); return; }
    arena.setPointerCapture(e.pointerId);
    g.drag = { id: e.pointerId };
    const x = document.createElement("span"); x.className = "xhair"; arena.appendChild(x); g.x = x;
    moveX(e);
  });
  function moveX(e) {
    const r = arena.getBoundingClientRect();
    g.x.style.left = e.clientX - r.left + "px"; g.x.style.top = e.clientY - r.top + "px";
  }
  arena.addEventListener("pointermove", (e) => { if (g && g.drag && g.drag.id === e.pointerId) moveX(e); });
  arena.addEventListener("pointerup", (e) => {
    if (!g || !g.drag || g.drag.id !== e.pointerId) return;
    g.drag = null;
    const head = g.en.querySelector(".e-head").getBoundingClientRect(), body = g.en.querySelector(".e-body").getBoundingClientRect();
    const r = arena.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (inside(head, e.clientX, e.clientY, 4)) { g.hs++; popText(arena, px, py, "HEADSHOT", "hs"); g.en.classList.add("down"); }
    else if (inside(body, e.clientX, e.clientY, 2)) { g.body++; popText(arena, px, py, "Body", "body"); }
    else { g.miss++; popText(arena, px, py, e.clientY < head.top ? "Over-dragged" : "Miss", "miss"); }
    g.i++; hud(); g.lock = true;
    setTimeout(() => { g.lock = false; g.i >= REPS ? end() : spawn(); }, 420);
  });
  function start() { g = { i: 0, hs: 0, body: 0, miss: 0 }; $(ID + "_msg").hidden = true; hud(); spawn(); }
  function end() {
    arena.querySelectorAll(".enemy,.xhair").forEach((e) => e.remove());
    const pct = Math.round((g.hs / REPS) * 100), best = load("drag_best", 0), isBest = pct > best;
    if (isBest) save("drag_best", pct);
    gameResult(ID, `${isBest ? "New best! " : ""}${pct}% headshots`, `${g.hs} head · ${g.body} body · ${g.miss} missed. ${pct >= 70 ? "Sharp drag control." : g.miss > g.body ? "You're dragging too far. Make shorter swipes." : "Drag a little further to reach the head."}`, start);
    g = null; hud(); markDrill("drag");
  }
  $(ID + "_msg").querySelector("[data-start]").onclick = start;
  onShow[ID] = () => { if (!g) hud(); };
})();

/* ---------- Tracking ---------- */
// Keep the pointer pressed on a target that wanders around the arena.
(function () {
  const ID = "track", DURATION = 20;
  gameShell(ID, { title: "Tracking drill", desc: "Hold your finger (or mouse button) on the moving target for 20 seconds.",
    note: "The target turns green while you're on it. Score is the share of time on target.", arenaClass: "track-arena" });
  const arena = $(ID + "_arena");
  let g = null;
  const hud = () => kpis($(ID + "_hud"), [["Time left", g ? Math.ceil(g.left) : DURATION, 0], ["On target %", g && g.t ? (g.on / g.t) * 100 : 0, 0, true], ["Speed", g ? g.speedLvl : 1, 0], ["Best %", load("track_best", 0), 0, true]]);
  const P = { x: 0, y: 0, down: false };
  arena.addEventListener("pointerdown", (e) => { if (!g) return; arena.setPointerCapture(e.pointerId); P.down = true; setP(e); });
  arena.addEventListener("pointermove", setP);
  ["pointerup", "pointercancel"].forEach((t) => arena.addEventListener(t, () => { P.down = false; }));
  function setP(e) { const r = arena.getBoundingClientRect(); P.x = e.clientX - r.left; P.y = e.clientY - r.top; }
  function newGoal() { const r = arena.getBoundingClientRect(); g.goal = { x: 30 + Math.random() * (r.width - 60), y: 30 + Math.random() * (r.height - 60) }; }
  function frame(now) {
    if (!g) return;
    const dt = Math.min(0.05, (now - g.last) / 1000); g.last = now;
    g.left -= dt; g.t += dt;
    g.speedLvl = 1 + Math.floor((DURATION - g.left) / 5);
    const speed = 90 + g.speedLvl * 45, dx = g.goal.x - g.pos.x, dy = g.goal.y - g.pos.y, d = Math.hypot(dx, dy);
    if (d < 6) newGoal(); else { g.pos.x += (dx / d) * speed * dt; g.pos.y += (dy / d) * speed * dt; }
    g.el.style.transform = `translate(${g.pos.x - 24}px, ${g.pos.y - 24}px)`;
    const onIt = P.down && Math.hypot(P.x - g.pos.x, P.y - g.pos.y) <= 30;
    if (onIt) g.on += dt;
    g.el.classList.toggle("on", onIt);
    if ((g.tick = (g.tick || 0) + dt) > 0.25) { g.tick = 0; hud(); }
    if (g.left <= 0) return end();
    requestAnimationFrame(frame);
  }
  function start() {
    const r = arena.getBoundingClientRect();
    g = { left: DURATION, t: 0, on: 0, speedLvl: 1, pos: { x: r.width / 2, y: r.height / 2 }, last: performance.now() };
    g.el = document.createElement("span"); g.el.className = "track-target"; arena.appendChild(g.el);
    $(ID + "_msg").hidden = true; newGoal(); hud(); requestAnimationFrame(frame);
  }
  function end() {
    g.el.remove();
    const pct = Math.round((g.on / g.t) * 100), best = load("track_best", 0), isBest = pct > best;
    if (isBest) save("track_best", pct);
    gameResult(ID, `${isBest ? "New best! " : ""}${pct}% on target`, pct >= 75 ? "Smooth tracking. Try it with your in-game sensitivity in mind." : "Keep your finger moving with the target instead of chasing it.", start);
    g = null; hud(); markDrill("track");
  }
  $(ID + "_msg").querySelector("[data-start]").onclick = start;
  onShow[ID] = () => { if (!g) hud(); };
})();

/* ---------- Tap Speed ---------- */
(function () {
  const ID = "taps", DURATION = 10;
  $(ID).innerHTML = `
    <button id="taps_pad" class="react-pad tap-pad" type="button">
      <span class="react-big" id="taps_big">Tap to start</span>
      <span class="react-sub" id="taps_sub">Tap as fast as you can for 10 seconds. Use one finger or alternate two.</span>
    </button>
    <div class="kpis kpis-4" id="taps_hud"></div>
    <p class="note">Fast taps help with gloo walls and tap-firing. Best taps per second is saved.</p>`;
  let g = null, cool = false;
  const hud = () => kpis($("taps_hud"), [["Time left", g ? Math.max(0, g.left) : DURATION, 1], ["Taps", g ? g.n : 0, 0, true], ["Per second", g && g.el ? g.n / g.el : 0, 1], ["Best / sec", load("taps_best", 0), 1, true]]);
  $("taps_pad").addEventListener("pointerdown", () => {
    if (cool) return;
    if (!g) {
      g = { n: 0, left: DURATION, el: 0, t0: performance.now() };
      $("taps_pad").dataset.state = "go"; $("taps_sub").textContent = "Keep going!";
      g.timer = setInterval(() => {
        g.el = (performance.now() - g.t0) / 1000; g.left = DURATION - g.el; hud();
        if (g.left <= 0) end();
      }, 100);
    }
    g.n++; $("taps_big").textContent = g.n; bump($("taps_big"));
  });
  function end() {
    clearInterval(g.timer);
    const tps = Math.round((g.n / DURATION) * 10) / 10, best = load("taps_best", 0), isBest = tps > best;
    if (isBest) save("taps_best", tps);
    $("taps_pad").dataset.state = "done";
    $("taps_big").textContent = `${tps} taps/sec`;
    $("taps_sub").textContent = `${g.n} taps${isBest ? " · new best!" : ""} · Tap to play again`;
    g = null; hud();
    cool = true; setTimeout(() => { cool = false; }, 900); // ignore the last frantic taps
  }
  onShow[ID] = () => { if (!g) hud(); };
})();

/* ---------- Peek Reflex ---------- */
// Enemies peek out from either side of a wall for a short window. Hit them before they hide.
(function () {
  const ID = "peek", PEEKS = 15;
  gameShell(ID, { title: "Peek reflex drill", desc: "Enemies peek out from behind the wall. Tap them before they duck back. 15 peeks.",
    note: "Each peek is a little shorter than the last. Best score is saved.", arenaClass: "peek-arena" });
  const arena = $(ID + "_arena");
  arena.insertAdjacentHTML("afterbegin", `<span class="cover"></span>`);
  let g = null;
  const best = () => load("peek_best", { hits: 0, avg: 0 });
  const hud = () => kpis($(ID + "_hud"), [["Peek", g ? Math.min(g.i, PEEKS) : 0, 0], ["Hits", g ? g.hits : 0, 0, true], ["Avg ms", g ? avgOf(g.times) : 0, 0], ["Best hits", best().hits, 0, true]]);
  function next() {
    if (g.i >= PEEKS) return end();
    g.wait = setTimeout(() => {
      const left = Math.random() < 0.5, en = document.createElement("button");
      en.type = "button"; en.className = "peeker " + (left ? "l" : "r"); en.setAttribute("aria-label", "Enemy");
      en.style.top = 20 + Math.random() * 55 + "%";
      arena.appendChild(en); g.en = en; g.t0 = performance.now(); g.i++; hud();
      const windowMs = Math.max(450, 1100 - g.i * 40);
      g.hide = setTimeout(() => { if (g && g.en === en) { en.classList.add("gone"); g.en = null; setTimeout(() => en.remove(), 200); next(); } }, windowMs);
    }, 500 + Math.random() * 1200);
  }
  arena.addEventListener("pointerdown", (e) => {
    if (!g || !g.en || e.target !== g.en) return;
    const ms = Math.round(performance.now() - g.t0), r = arena.getBoundingClientRect();
    clearTimeout(g.hide); g.hits++; g.times.push(ms);
    popText(arena, e.clientX - r.left, e.clientY - r.top, ms + " ms", "hs");
    g.en.classList.add("hit"); const en = g.en; g.en = null; setTimeout(() => en.remove(), 250);
    hud(); next();
  });
  function start() { g = { i: 0, hits: 0, times: [] }; $(ID + "_msg").hidden = true; hud(); next(); }
  function end() {
    const avg = Math.round(avgOf(g.times)), b = best(), isBest = g.hits > b.hits || (g.hits === b.hits && g.hits && avg < b.avg);
    if (isBest) save("peek_best", { hits: g.hits, avg });
    gameResult(ID, `${isBest ? "New best! " : ""}${g.hits} / ${PEEKS} hits`, g.hits ? `Average ${avg} ms per hit.` : "Watch both edges of the wall and react to movement.", start);
    g = null; hud(); markDrill("peek");
  }
  $(ID + "_msg").querySelector("[data-start]").onclick = start;
  onShow[ID] = () => { if (!g) hud(); };
})();

/* ---------- Spot the Enemy ---------- */
// One tile is a slightly different shade. Each find makes the grid bigger and the difference smaller.
(function () {
  const ID = "spot", DURATION = 30;
  gameShell(ID, { title: "Spot the enemy", desc: "One tile is a slightly different shade, like an enemy in a bush. Find it fast. Wrong taps cost 2 seconds.",
    note: "Your eyes get trained to catch small differences on screen. Best level is saved.", arenaClass: "spot-arena" });
  const arena = $(ID + "_arena");
  let g = null;
  const hud = () => kpis($(ID + "_hud"), [["Time left", g ? Math.max(0, g.left) : DURATION, 0], ["Level", g ? g.level : 0, 0, true], ["Wrong taps", g ? g.wrong : 0, 0], ["Best level", load("spot_best", 0), 0, true]]);
  function board() {
    arena.querySelector(".spot-grid")?.remove();
    const n = Math.min(8, 2 + Math.floor(g.level / 2)), odd = Math.floor(Math.random() * n * n);
    const h = 90 + Math.floor(Math.random() * 60), diff = Math.max(4, 22 - g.level * 1.2);
    const grid = document.createElement("div");
    grid.className = "spot-grid"; grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    grid.innerHTML = Array.from({ length: n * n }, (_, i) =>
      `<button type="button" class="tile" data-odd="${i === odd ? 1 : 0}" aria-label="Tile" style="background:hsl(${h} 45% ${i === odd ? 34 + diff : 34}%)"></button>`).join("");
    arena.appendChild(grid);
  }
  arena.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".tile");
    if (!g || !t) return;
    if (t.dataset.odd === "1") { g.level++; board(); }
    else { g.wrong++; g.left -= 2; t.classList.add("wrong"); arena.querySelector('.tile[data-odd="1"]').classList.add("reveal"); setTimeout(() => g && board(), 350); }
    hud();
  });
  function start() {
    g = { level: 0, wrong: 0, left: DURATION }; $(ID + "_msg").hidden = true; board(); hud();
    g.timer = setInterval(() => { g.left--; hud(); if (g.left <= 0) end(); }, 1000);
  }
  function end() {
    clearInterval(g.timer); arena.querySelector(".spot-grid")?.remove();
    const best = load("spot_best", 0), isBest = g.level > best;
    if (isBest) save("spot_best", g.level);
    gameResult(ID, `${isBest ? "New best! " : ""}Level ${g.level}`, `${g.wrong} wrong tap${g.wrong === 1 ? "" : "s"}.`, start);
    g = null; hud(); markDrill("spot");
  }
  $(ID + "_msg").querySelector("[data-start]").onclick = start;
  onShow[ID] = () => { if (!g) hud(); };
})();
