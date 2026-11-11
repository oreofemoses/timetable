// Shared open/close behaviour for the slide-up panels (day notepad, my week,
// to-do, diary, reminders, settings). The slide itself is CSS: adding .open
// slides in, removing it slides out.
//
// - Opened or closed with the keyboard: no slide, it just appears/disappears
//   (keyboard actions never animate).
// - On a phone she can drag the panel down by its top strip to close it.

const timers = new WeakMap();
const FLICK = 0.11; // px/ms: a quick flick down is enough to close

// make a change with transitions switched off, then switch them straight back
// on. Reading the computed styles applies the change first, so nothing slides.
// (Waiting for animation frames instead isn't safe: an idle page may not
// draw any, which would leave transitions off for the next tap.)
function instantly(dlg, change) {
  dlg.classList.add("instant");
  change();
  void getComputedStyle(dlg).transform;
  void getComputedStyle(dlg, "::backdrop").opacity;
  dlg.classList.remove("instant");
}

export function openDrawer(dlg, { instant = false } = {}) {
  clearTimeout(timers.get(dlg));
  dlg.style.transform = "";
  const show = () => {
    if (!dlg.open) dlg.showModal();
    dlg.getBoundingClientRect(); // start from the closed position so it slides
    dlg.classList.add("open");
  };
  if (instant) instantly(dlg, show);
  else show();
}

export function closeDrawer(dlg, { instant = false } = {}) {
  if (!dlg.open) return;
  clearTimeout(timers.get(dlg));
  dlg.style.transform = "";
  if (instant) {
    instantly(dlg, () => { dlg.classList.remove("open"); dlg.close(); });
    return;
  }
  dlg.classList.remove("open");
  const finish = () => {
    clearTimeout(timers.get(dlg));
    dlg.removeEventListener("transitionend", onEnd);
    if (!dlg.classList.contains("open")) dlg.close();
  };
  const onEnd = (e) => { if (e.target === dlg && !e.pseudoElement) finish(); }; // not the backdrop's fade
  dlg.addEventListener("transitionend", onEnd);
  timers.set(dlg, setTimeout(finish, 400)); // in case transitionend never comes
}

// a click with detail 0 came from the keyboard (Enter / Space)
export const fromKeyboard = (e) => !!e && e.detail === 0;

// ✕ button, Escape, tapping the dimmed backdrop, or dragging it down all close it.
// onEscape can return true to handle Escape itself (e.g. close a form first).
export function wireDrawer(dlg, { onEscape } = {}) {
  dlg.querySelector(".np-close").addEventListener("click", (e) => closeDrawer(dlg, { instant: fromKeyboard(e) }));
  dlg.addEventListener("close", () => { dlg.classList.remove("open", "dragging"); dlg.style.transform = ""; });
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    if (onEscape && onEscape()) return;
    closeDrawer(dlg, { instant: true }); // Escape is a keyboard action
  });
  let downOnBackdrop = false;
  dlg.addEventListener("pointerdown", (e) => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg && downOnBackdrop) closeDrawer(dlg);
  });
  wireDrag(dlg);
}

// ---------- drag the top strip down to close ----------
function wireDrag(dlg) {
  const handle = dlg.querySelector(".np-top");
  if (!handle) return;
  let drag = null;

  handle.addEventListener("pointerdown", (e) => {
    if (drag || !e.isPrimary || e.button > 0 || e.target.closest("button, input, a")) return;
    drag = { id: e.pointerId, y: e.clientY, samples: [[e.timeStamp, 0]], dy: 0 };
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    let dy = e.clientY - drag.y;
    if (dy < 0) dy = -Math.sqrt(-dy) * 2; // pulling up: it resists instead of hitting a wall
    if (!dlg.classList.contains("dragging") && Math.abs(dy) < 4) return;
    dlg.classList.add("dragging");
    dlg.style.transform = `translateY(${dy}px)`; // follows her finger exactly
    drag.dy = dy;
    drag.samples.push([e.timeStamp, dy]);
    if (drag.samples.length > 8) drag.samples.shift();
  });

  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, samples } = drag;
    drag = null;
    if (!dlg.classList.contains("dragging")) return;
    // speed over the last ~100ms of the drag
    const end = samples[samples.length - 1];
    let k = samples.length - 1;
    while (k > 0 && end[0] - samples[k - 1][0] <= 100) k--;
    const v = end[0] > samples[k][0] ? (end[1] - samples[k][1]) / (end[0] - samples[k][0]) : 0;
    const close = dy > dlg.offsetHeight / 3 || (v > FLICK && dy > 0);
    // transitions come back on; it slides from where her finger left it
    dlg.classList.remove("dragging");
    if (close) closeDrawer(dlg);
    else dlg.style.transform = ""; // springs back up
  };
  handle.addEventListener("pointerup", release);
  handle.addEventListener("pointercancel", release);
}
