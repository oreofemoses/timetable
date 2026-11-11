// Rings reminders while the app is open: a card slides down from the top,
// the alarm clock wiggles and shows a count, the tab title gets a ⏰, and a
// soft chime plays (if she allows it). Checks exactly when the next
// reminder is due, plus every 30 seconds as a safety net.
import { whenLabel } from "./shared.js";
import * as store from "./store.js";
import { openReminders, refreshReminders } from "./reminders.js";
import { chimeOn } from "./prefs.js";

const card = document.getElementById("alarmCard");
const textEl = card.querySelector(".alarm-text");
const whenEl = card.querySelector(".alarm-when");
const moreBtn = card.querySelector(".alarm-more");
const announce = document.getElementById("alarmAnnounce");
const icon = document.querySelector(".f-remind");
const count = icon.querySelector(".count");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// an open panel (day notepad etc.) blocks everything outside it, so then the
// card has to open on top of it as its own window to be tappable
const panelOpen = () => !!document.querySelector("dialog.notepad[open]");

let ringing = [];   // ids ringing at the last check
let current = null; // id shown on the card
let nextTimer = 0;
let hideTimer = 0;

// ---------- sound ----------
// browsers only allow sound after she has touched the page once
let audio = null;
const unlock = () => {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no sound */ }
};
document.addEventListener("pointerdown", unlock, { capture: true, once: true });
document.addEventListener("keydown", unlock, { capture: true, once: true });

function chime() {
  if (!audio || !chimeOn()) return;
  if (audio.state === "suspended") audio.resume();
  const t0 = audio.currentTime + 0.02;
  [[880, 0], [1175, 0.16], [1568, 0.32]].forEach(([freq, dt]) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + dt);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + dt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + dt);
    osc.stop(t0 + dt + 0.65);
  });
}

// ---------- the alarm clock icon ----------
function wiggle() {
  if (reduceMotion.matches) return;
  icon.classList.remove("ringing");
  void icon.offsetWidth; // restart the animation
  icon.classList.add("ringing");
}
icon.addEventListener("animationend", (e) => {
  if (e.animationName === "ring") icon.classList.remove("ringing");
});

// ---------- the card ----------
function showCard(due) {
  const r = due[0];
  current = r.id;
  textEl.textContent = r.text;
  whenEl.textContent = whenLabel(store.dueAt(r));
  moreBtn.hidden = due.length < 2;
  moreBtn.textContent = `+${due.length - 1} more`;
  if (card.open && card.classList.contains("show")) return;
  clearTimeout(hideTimer);
  if (!card.open) {
    if (panelOpen()) {
      card.showModal(); // on top of the open panel (and focus moves to it)
    } else {
      // a light card that doesn't block the calendar or steal focus
      const prev = document.activeElement;
      card.show();
      if (prev && prev !== document.body) prev.focus({ preventScroll: true });
      else document.activeElement?.blur();
    }
  }
  card.getBoundingClientRect(); // start above the screen so it slides down
  card.classList.add("show");
}

function hideCard() {
  current = null;
  if (!card.classList.contains("show")) return;
  card.classList.remove("show");
  hideTimer = setTimeout(() => {
    if (!card.classList.contains("show") && card.open) card.close();
  }, 260);
}

// Escape on the card = snooze
card.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (current) store.snoozeReminder(current, 10);
});

card.querySelector(".alarm-snooze").addEventListener("click", () => { if (current) store.snoozeReminder(current, 10); });
card.querySelector(".alarm-done").addEventListener("click", () => { if (current) store.dismissReminder(current); });
moreBtn.addEventListener("click", (e) => openReminders({ instant: e.detail === 0 })); // keyboard: no slide

// ---------- checking ----------
function setTitle(on) {
  const base = document.title.replace(/^⏰ /, "");
  document.title = on ? `⏰ ${base}` : base;
}

function check() {
  const due = store.remindersDue(Date.now());
  const ids = due.map((r) => r.id);
  const fresh = due.filter((r) => !ringing.includes(r.id));
  ringing = ids;

  count.hidden = !ids.length;
  count.textContent = ids.length;
  icon.setAttribute("aria-label", ids.length ? `Reminders, ${ids.length} ringing` : "Reminders");
  setTitle(ids.length > 0);

  if (ids.length) showCard(due);
  else hideCard();
  if (fresh.length) {
    wiggle();
    chime();
    announce.textContent = `Reminder: ${fresh.map((r) => r.text).join(", ")}`;
  }
  refreshReminders();
  scheduleNext();
}

function scheduleNext() {
  clearTimeout(nextTimer);
  const next = store.remindersUpcoming(Date.now())[0];
  if (!next) return;
  const ms = store.dueAt(next).getTime() - Date.now() + 200;
  nextTimer = setTimeout(check, Math.min(Math.max(ms, 0), 2147483647));
}

store.subscribe(check);
setInterval(check, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
check();
