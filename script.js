import { MONTHS, DAYS, HEADS, sticker, formatTime, esc, CHECK_SVG, moodFace, NOTE_SVG } from "./shared.js";
import * as store from "./store.js";
import { openDay } from "./notepad.js";
import { openSchedule } from "./schedule.js";
import { openTodos } from "./todos.js";
import { openDiary } from "./diary.js";
import { openReminders } from "./reminders.js";
import "./alarm.js"; // starts listening for reminders that are due
import "./settings.js"; // the gear: home screen, backup, offline support

// is a panel (day notepad, my week) open? then the calendar ignores keys
// (the ringing reminder card is a dialog too, but it shouldn't block the calendar)
const panelOpen = () => !!document.querySelector("dialog.notepad[open]");

(() => {
  const COILS = 9;         // spiral coils across the top
  const HOLE_Y = 13;        // px from the top edge of a page to the centre of its holes
  // add ?slow=10 to the URL to watch a flip in slow motion
  const SLOW = Math.max(1, Number(new URLSearchParams(location.search).get("slow")) || 1);
  const FLIP_MS = 800 * SLOW;  // one full peel + flip
  const FAST_MS = 450 * SLOW;  // skipping several days, or more taps already waiting
  const PEEK_T = 0.1;          // how far the corner lifts when the mouse hovers it
  const FLICK = 0.11;          // px/ms: a quick flick is enough to turn the page

  const sheetsEl = document.getElementById("sheets");
  const calendarEl = document.getElementById("calendar");
  const ringsEl = document.getElementById("rings");
  const flipLayer = document.getElementById("flipLayer");
  const announce = document.getElementById("announce");
  const toast = document.getElementById("toast");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diffDays = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeInQuad = (t) => t * t;

  let shown = startOfDay(new Date()); // the page lying flat on top
  let target = shown;                 // the day she has asked for
  let topSheet = null;
  let flip = null;                    // the page that is turning right now, if any
  let raf = 0;
  let gesture = null;                 // pointer currently pressed on the calendar

  // ---------- coils & holes ----------
  const coilX = (i) => 8 + (i * 84) / (COILS - 1); // % across the page

  function holesHTML() {
    let h = "";
    for (let i = 0; i < COILS; i++) h += `<i style="left:${coilX(i)}%"></i>`;
    return `<div class="holes">${h}</div>`;
  }

  // Each coil comes up out of its hole, loops over the top edge and goes down
  // behind the page, so we only draw ~3/4 of a round loop.
  (function buildRings() {
    const loop = "M13 35 A10 14.5 0 1 0 3.05 22";
    let html = "";
    for (let i = 0; i < COILS; i++) {
      html += `<svg class="coil" style="left:${coilX(i)}%" viewBox="0 0 26 40" aria-hidden="true">
        <path class="wire-ink" d="${loop}" /><path class="wire" d="${loop}" /><path class="wire-shine" d="M21 14 A10 14.5 0 0 0 16 7" />
      </svg>`;
    }
    ringsEl.innerHTML = html;
  })();

  // ---------- pages ----------
  function relLabel(d) {
    const n = diffDays(d, new Date());
    if (n === 0) return "";
    if (n === 1) return "tomorrow";
    if (n === -1) return "yesterday";
    return n > 0 ? `in ${n} days` : `${-n} days ago`;
  }

  // the day's plans and to-dos, as lines written on the page
  function dayLines(d) {
    // a smaller calendar (short phone screens) has room for one line fewer
    const MAX_LINES = calendarEl.offsetWidth < 260 ? 3 : 4;
    const plans = store.plansOn(d).map((p) => `
      <li>${sticker(p.type)}${p.start ? `<span class="l-time">${formatTime(p.start)}</span>` : ""}<span class="l-title">${esc(p.title)}</span></li>`);
    const todos = store.todosOn(d).sort((a, b) => a.done - b.done).map((t) => `
      <li class="todo-line${t.done ? " done" : ""}"><span class="l-box">${t.done ? CHECK_SVG : ""}</span><span class="l-title">${esc(t.text)}</span></li>`);
    const lines = [...plans, ...todos];
    if (lines.length <= MAX_LINES) return lines;
    return [...lines.slice(0, MAX_LINES - 1), `<li class="more">+${lines.length - MAX_LINES + 1} more…</li>`];
  }

  function makeSheet(d) {
    const sheet = document.createElement("div");
    const dow = d.getDay();
    sheet.className = "sheet" + (dow === 0 || dow === 6 ? " weekend" : "");
    sheet.style.setProperty("--head", HEADS[d.getMonth()]);
    const isToday = diffDays(d, new Date()) === 0;
    const badge = isToday ? '<span class="badge">today ♡</span>' : "";
    const curl = `
      <div class="curl" title="Drag or tap to turn the page">
        <svg viewBox="0 0 54 54" aria-hidden="true">
          <path class="under" d="M54 4 L54 54 L4 54 Z" />
          <path class="flap-ear" d="M54 4 L4 54 Q4 18 14 12 Q24 6 54 4 Z" />
        </svg>
      </div>`;
    const lines = dayLines(d);
    // the day's mood sticker (and a little paper if she wrote a note)
    const entry = store.entryOn(d);
    const stuck = entry ? `
          <div class="page-stickers">${entry.note.trim() ? NOTE_SVG : ""}${entry.mood ? moodFace(entry.mood) : ""}</div>` : "";
    // a busy day: smaller date, the day written underneath on lined paper.
    // an empty day: the big date on its own, with a hint.
    const body = lines.length ? `
        <div class="sheet-body compact">
          ${stuck}
          <div class="day-row">
            <div class="date">${d.getDate()}</div>
            <div class="day-meta">
              <div class="weekday">${DAYS[dow]}</div>
              ${badge || `<span class="rel">${relLabel(d)}</span>`}
            </div>
          </div>
          <ul class="day-lines">${lines.join("")}</ul>
          ${curl}
        </div>` : `
        <div class="sheet-body">
          ${badge}
          ${stuck}
          <div class="date">${d.getDate()}</div>
          <div class="weekday">${DAYS[dow]}</div>
          <span class="hint">tap to add plans</span>
          <span class="rel">${relLabel(d)}</span>
          ${curl}
        </div>`;
    sheet.innerHTML = `
      <div class="face front">
        <div class="sheet-head">
          ${holesHTML()}
          <span class="month">${MONTHS[d.getMonth()].toUpperCase()}</span>
          <span class="year">${d.getFullYear()}</span>
        </div>
        ${body}
        <div class="shade"></div>
      </div>`;
    return sheet;
  }

  // ---------- peel geometry ----------
  // Clip a convex polygon to one side of the line through P with normal N.
  function clipPoly(poly, P, N, keepPositive) {
    const s = keepPositive ? 1 : -1;
    const side = (X) => s * ((X[0] - P[0]) * N[0] + (X[1] - P[1]) * N[1]);
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      const fa = side(A), fb = side(B);
      if (fa >= 0) out.push(A);
      if ((fa >= 0) !== (fb >= 0)) {
        const t = fa / (fa - fb);
        out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]);
      }
    }
    return out;
  }
  const toClip = (poly) => poly.length
    ? `polygon(${poly.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(",")})`
    : "polygon(0 0,0 0,0 0)";
  const toPts = (poly) => poly.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  // Where is the fold at progress t (0 = flat, 1 = gone over the rings)?
  //  0 → SPLIT : the bottom-right corner peels up, the fold sweeps diagonally
  //              across the page and straightens until it lines up with the holes
  //  SPLIT → 1 : the whole page swings over the rings and drops behind
  // The lift angle keeps moving through SPLIT (matched speed on both sides),
  // so the page never stalls flat over the title.
  const SPLIT = 0.62;
  const PEEL_ANGLE = 162;  // how far the flap is turned when the fold reaches the rings
  const END_ANGLE = 262;   // edge-on behind the calendar
  function foldAt(t, W, H) {
    if (t < SPLIT) {
      const u = t / SPLIT;
      // lifts quickly so the paper back shows early, still moving at u = 1
      const angle = PEEL_ANGLE * (0.75 * (1 - Math.pow(1 - u, 2.4)) + 0.25 * u);
      // fold direction: starts diagonal at the corner, then levels off by 55% of
      // the sweep, so the big part of the flap swings up over the coils instead
      // of being thrown out past the calendar's side (max ~38px vs 146px before)
      const phi = (-46 * Math.PI / 180) * (1 - Math.pow(Math.min(1, u / 0.55), 1.5));
      const N = [-Math.sin(phi), Math.cos(phi)];                   // normal → corner
      const dist = (H - HOLE_Y) * easeInOutSine(u) + 0.5;          // corner → fold
      const P = [W - N[0] * dist, H - N[1] * dist];
      return { P, N, dir: [Math.cos(phi), Math.sin(phi)], angle };
    }
    // then it carries on over the rings and drops behind, speeding up as it goes
    const v = (t - SPLIT) / (1 - SPLIT);
    const angle = lerp(PEEL_ANGLE, END_ANGLE, 0.25 * v + 0.75 * v * v);
    return { P: [W / 2, HOLE_Y], N: [0, 1], dir: [1, 0], angle };
  }

  // Build the moving parts for one peel of `page` (which sits on top of `under`).
  function makePeel(page, under) {
    const W = page.offsetWidth, H = page.offsetHeight;
    const rect = [[0, 0], [W, 0], [W, H], [0, H]];
    const NS = "http://www.w3.org/2000/svg";

    // shadow + crease drawn on the part of the page that stays down
    const crease = document.createElementNS(NS, "svg");
    crease.setAttribute("class", "peel-svg");
    crease.innerHTML = `
      <defs><linearGradient id="castGrad" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#33293d" stop-opacity=".28"/><stop offset="1" stop-color="#33293d" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon class="cast" fill="url(#castGrad)" /><line class="crease" />`;

    // the lifted flap: a copy of the page front, plus a paper back
    const flap = document.createElement("div");
    flap.className = "flap";
    flap.style.setProperty("--head", page.style.getPropertyValue("--head"));
    flap.appendChild(page.querySelector(".front").cloneNode(true));
    const back = document.createElement("div");
    back.className = "face back-paper";
    back.innerHTML = holesHTML(); // the coils thread through these from behind
    flap.appendChild(back);
    const flapSvg = document.createElementNS(NS, "svg");
    flapSvg.setAttribute("class", "peel-svg");
    flapSvg.innerHTML = `
      <defs><linearGradient id="flapGrad" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#33293d" stop-opacity=".22"/><stop offset=".55" stop-color="#33293d" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon class="flap-shade" fill="url(#flapGrad)" /><line class="crease" />`;
    flap.appendChild(flapSvg);

    page.after(crease);
    flipLayer.appendChild(flap);
    const underShade = under.querySelector(".shade");
    const g1 = crease.querySelector("linearGradient"), g2 = flapSvg.querySelector("linearGradient");
    const castPoly = crease.querySelector("polygon"), crease1 = crease.querySelector("line");
    const flapPoly = flapSvg.querySelector("polygon"), crease2 = flapSvg.querySelector("line");
    let showingBack = false;
    let behind = false;

    function setLine(line, a, b) {
      line.setAttribute("x1", a[0]); line.setAttribute("y1", a[1]);
      line.setAttribute("x2", b[0]); line.setAttribute("y2", b[1]);
    }
    function setGrad(g, a, b) {
      g.setAttribute("x1", a[0]); g.setAttribute("y1", a[1]);
      g.setAttribute("x2", b[0]); g.setAttribute("y2", b[1]);
    }

    function render(t) {
      t = clamp(t);
      const { P, N, dir, angle } = foldAt(t, W, H);
      const stay = clipPoly(rect, P, N, false);
      const lift = clipPoly(rect, P, N, true);

      // the fold edge = the two ends of the line where it crosses the page
      const onLine = stay.filter(([x, y]) => Math.abs((x - P[0]) * N[0] + (y - P[1]) * N[1]) < 0.01);
      const [e1, e2] = onLine.length >= 2 ? onLine : [P, P];

      page.style.clipPath = toClip(stay);
      crease.style.clipPath = toClip(stay);
      castPoly.setAttribute("points", toPts(stay));
      const lifted = Math.max(0, Math.sin((angle * Math.PI) / 180));
      setGrad(g1, P, [P[0] - N[0] * 46, P[1] - N[1] * 46]);
      castPoly.style.opacity = t < SPLIT ? lifted : 0;
      setLine(crease1, e1, e2);
      crease1.style.opacity = t > 0.003 && t < SPLIT ? 1 : 0;

      flap.style.clipPath = toClip(lift);
      flap.style.transformOrigin = `${P[0]}px ${P[1]}px`;
      flap.style.transform = `rotate3d(${dir[0]}, ${dir[1]}, 0, ${angle}deg)`;
      if ((angle > 90) !== showingBack) {
        showingBack = angle > 90;
        flap.classList.toggle("showback", showingBack);
      }
      // in front of the calendar the page covers the coils; once it has gone
      // past 180° it's behind the calendar, so the coils come back in front
      if ((angle >= 180) !== behind) {
        behind = angle >= 180;
        flipLayer.classList.toggle("behind", behind);
      }
      flapPoly.setAttribute("points", toPts(lift));
      setGrad(g2, P, [P[0] + N[0] * W, P[1] + N[1] * W]);
      setLine(crease2, e1, e2);

      // the strip above the holes and the flap fade only at the very end,
      // so a page coming back (Back) is visible almost at once
      const fade = 1 - clamp((t - 0.9) / 0.1);
      flap.style.opacity = fade;
      page.style.opacity = t < SPLIT ? 1 : fade;

      underShade.style.opacity = 0.32 * (1 - easeInQuad(t));
    }

    function cleanup() {
      crease.remove(); flap.remove();
      flipLayer.classList.remove("behind");
      page.style.clipPath = ""; page.style.opacity = "";
      underShade.style.opacity = "";
    }
    return { render, cleanup, H };
  }

  // ---------- the flip engine ----------
  // A flip is steered rather than played: every frame it moves toward
  // whichever end matches `target`. A tap the other way mid-flip reverses it
  // from where it is, and taps never get lost.
  function createFlip(toDate) {
    const dir = Math.sign(diffDays(toDate, shown));
    if (!dir) return;
    const fresh = makeSheet(toDate);
    let page, under;
    if (dir > 0) { // this page peels away to show the new one underneath
      sheetsEl.insertBefore(fresh, topSheet);
      page = topSheet; under = fresh;
    } else {       // the earlier page comes back over the rings on top
      sheetsEl.appendChild(fresh);
      page = fresh; under = topSheet;
    }
    const endT = dir > 0 ? 1 : 0;
    flip = {
      dir, endT, t: 1 - endT,
      fromDate: shown, toDate,
      fromSheet: topSheet, toSheet: fresh,
      peel: makePeel(page, under),
      hold: null,      // park at this t (hover peek) instead of finishing
      dragging: false, // her finger is moving it directly
    };
    flip.peel.render(flip.t);
    startLoop();
  }

  function goalFor(f) {
    if (f.hold !== null) return f.hold;
    return Math.sign(diffDays(target, f.fromDate)) === f.dir ? f.endT : 1 - f.endT;
  }

  function startLoop() {
    if (raf) return;
    let last = performance.now();
    const frame = (now) => {
      raf = 0;
      if (!flip) return;
      // a frame's timestamp can be a little earlier than the moment the flip started
      const dt = clamp(now - last, 0, 64);
      last = Math.max(last, now);
      if (!flip.dragging) {
        const goal = goalFor(flip);
        const fast = Math.abs(diffDays(flip.toDate, flip.fromDate)) > 1
          || Math.sign(diffDays(target, flip.toDate)) === flip.dir;
        const step = dt / (fast ? FAST_MS : FLIP_MS);
        const before = flip.t;
        flip.t = goal > flip.t ? Math.min(goal, flip.t + step) : Math.max(goal, flip.t - step);
        if (flip.t !== before) flip.peel.render(flip.t);
        if (flip.t === goal && flip.hold === null) { settle(goal === flip.endT); return; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function settle(completed) {
    const f = flip;
    flip = null;
    f.peel.cleanup();
    (completed ? f.fromSheet : f.toSheet).remove();
    topSheet = completed ? f.toSheet : f.fromSheet;
    shown = completed ? f.toDate : f.fromDate;
    say(shown);
    if (diffDays(target, shown)) createFlip(target);
  }

  // instant page change: keyboard, and anything else that shouldn't animate
  function jumpTo(date) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    flip = null;
    gesture = null;
    calendarEl.classList.remove("grabbing");
    topSheet = makeSheet(date);
    sheetsEl.replaceChildren(topSheet);
    flipLayer.replaceChildren();
    flipLayer.classList.remove("behind");
    shown = target = startOfDay(date);
    say(shown);
  }

  // reduced motion: a short crossfade instead of the peel
  function crossfadeTo(date) {
    if (!diffDays(date, shown)) return;
    const next = makeSheet(date);
    sheetsEl.appendChild(next);
    topSheet = next;
    shown = target = date;
    say(shown);
    next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" }).onfinish = () => {
      if (topSheet !== next) return;
      [...sheetsEl.children].forEach((el) => { if (el !== next) el.remove(); });
    };
  }

  function go(delta) {
    if (!delta) return;
    target = addDays(target, delta);
    if (reduceMotion.matches) { crossfadeTo(target); return; }
    if (flip) {
      if (!flip.dragging) flip.hold = null;
      startLoop();
      return;
    }
    createFlip(target);
  }

  function say(d) {
    const name = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    announce.textContent = name;
    calendarEl.setAttribute("aria-label", `${name}. Open to see and add plans`);
    const ringing = document.title.startsWith("⏰ ") ? "⏰ " : ""; // keep the alarm's marker
    document.title = `${ringing}${MONTHS[d.getMonth()]} ${d.getDate()} · Vida's Timetable`;
  }

  // when she adds or ticks something, rewrite the page that's showing
  store.subscribe(() => {
    if (flip || !topSheet) return;
    const fresh = makeSheet(shown);
    topSheet.replaceWith(fresh);
    topSheet = fresh;
  });

  // the little count on the to-do sticky note: left today + left from before
  const todoBtn = document.querySelector(".f-todo");
  const todoCount = todoBtn.querySelector(".count");
  function updateTodoCount() {
    const n = store.openTodoCount(store.dateKey(new Date()));
    todoCount.textContent = n > 99 ? "99+" : n;
    todoCount.hidden = !n;
    todoBtn.setAttribute("aria-label", n ? `To-do, ${n} left` : "To-do");
  }
  store.subscribe(updateTodoCount);
  updateTodoCount();

  // the diary asks to open a day: turn the calendar there and open its notepad
  document.addEventListener("vida:open-day", (e) => {
    const [y, m, d] = e.detail.key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    jumpTo(date);
    openDay(date, { instant: e.detail.instant });
  });

  // ---- initial page ----
  topSheet = makeSheet(shown);
  sheetsEl.appendChild(topSheet);
  say(shown);

  // ---- buttons ----
  // Enter/Space on a focused button gives a click with detail 0: treat it as
  // keyboard navigation and change the page instantly.
  const viaKeyboard = (e) => e.detail === 0;
  const today = () => startOfDay(new Date());
  document.getElementById("next").addEventListener("click", (e) =>
    viaKeyboard(e) ? jumpTo(addDays(target, 1)) : go(1));
  document.getElementById("prev").addEventListener("click", (e) =>
    viaKeyboard(e) ? jumpTo(addDays(target, -1)) : go(-1));
  document.getElementById("today").addEventListener("click", (e) =>
    viaKeyboard(e) ? jumpTo(today()) : go(diffDays(today(), target)));

  // ---- keyboard: no animation, ever ----
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || panelOpen()) return;
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
    if ((e.key === "Enter" || e.key === " ") && e.target === calendarEl) {
      e.preventDefault();
      openDay(shown, { instant: true }); // keyboard: no slide
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); jumpTo(addDays(target, 1)); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); jumpTo(addDays(target, -1)); }
    else if (e.key.toLowerCase() === "t") jumpTo(today());
  });

  // ---- pointer: drag the dog-ear to peel, or swipe the page ----
  function velocity(samples) {
    const [tEnd, pEnd] = samples[samples.length - 1];
    let k = samples.length - 1;
    while (k > 0 && tEnd - samples[k - 1][0] <= 100) k--;
    const [tStart, pStart] = samples[k];
    return tEnd > tStart ? (pEnd - pStart) / (tEnd - tStart) : 0;
  }
  // how far she has pulled the corner toward the top-left
  const pullOf = (g, e) => (-(e.clientX - g.x) - (e.clientY - g.y)) / Math.SQRT2;

  calendarEl.addEventListener("pointerdown", (e) => {
    if (gesture || !e.isPrimary || e.button > 0) return; // ignore extra fingers
    gesture = {
      id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp,
      onCurl: !!e.target.closest(".curl"), moved: false, grab: false, startT: 0,
      samples: [[e.timeStamp, 0]],
    };
    calendarEl.setPointerCapture(e.pointerId);
    if (!gesture.onCurl || reduceMotion.matches) return;
    // grab the corner: start a fresh peel, or take over the hover peek
    if (!flip && !diffDays(target, shown)) createFlip(addDays(shown, 1));
    else if (!flip || flip.hold === null) return;
    flip.hold = null;
    flip.dragging = true;
    gesture.grab = true;
    gesture.startT = flip.t;
    calendarEl.classList.add("grabbing");
  });

  calendarEl.addEventListener("pointermove", (e) => {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6) g.moved = true;
    if (!g.grab || !flip || !flip.dragging) return;
    const pull = pullOf(g, e);
    flip.t = clamp(g.startT + pull / (flip.peel.H * 1.15));
    flip.peel.render(flip.t);
    g.samples.push([e.timeStamp, pull]);
    if (g.samples.length > 12) g.samples.shift();
  });

  function endGesture(e, cancelled) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null;
    calendarEl.classList.remove("grabbing");
    if (g.grab && flip && flip.dragging) {
      g.samples.push([e.timeStamp, pullOf(g, e)]);
      const v = velocity(g.samples);
      // a tap, a flick, or pulled far enough turns the page; otherwise it falls back
      const complete = !cancelled && (!g.moved || v > FLICK || (v > -FLICK && flip.t > 0.4));
      flip.dragging = false;
      target = complete ? flip.toDate : flip.fromDate;
      startLoop();
      return;
    }
    if (cancelled) return;
    if (g.onCurl && !g.moved) { go(1); return; }
    if (!g.moved) { if (!flip) openDay(shown); return; } // tap the page: open the day
    const dy = e.clientY - g.y;
    const speed = Math.abs(dy) / Math.max(1, e.timeStamp - g.time);
    if (Math.abs(dy) > 40 || (Math.abs(dy) > 12 && speed > FLICK)) go(dy < 0 ? 1 : -1);
  }
  calendarEl.addEventListener("pointerup", (e) => endGesture(e, false));
  calendarEl.addEventListener("pointercancel", (e) => endGesture(e, true));

  // ---- mouse hover on the dog-ear: the corner lifts a little ----
  sheetsEl.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !canHover.matches || reduceMotion.matches || gesture) return;
    if (!e.target.closest(".curl") || flip || diffDays(target, shown)) return;
    createFlip(addDays(shown, 1));
    flip.hold = PEEK_T;
  });
  sheetsEl.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse" || !flip || flip.hold === null) return;
    const to = e.relatedTarget;
    if (to && to.closest && to.closest(".curl")) return; // still over a dog-ear
    flip.hold = null;
    startLoop();
  });

  // ---- feature placeholders ----
  let toastTimer;
  document.querySelectorAll(".feature").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const opts = { instant: viaKeyboard(e) }; // Enter/Space: open without sliding
      if (btn.classList.contains("f-classes")) { openSchedule(opts); return; }
      if (btn.classList.contains("f-todo")) { openTodos(opts); return; }
      if (btn.classList.contains("f-notes")) { openDiary(opts); return; }
      if (btn.classList.contains("f-remind")) { openReminders(opts); return; }
      toast.textContent = `${btn.dataset.feature} — coming soon ✿`;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
    });
  });
})();
