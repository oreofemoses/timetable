// The diary panel (diary icon): today's mood + note, a month of moods at a
// glance, and her past notes. Tapping a day opens it on the calendar.
import { MONTHS, DAYS, WEEK, MOODS, moodOf, moodFace } from "./shared.js";
import * as store from "./store.js";
import { createEntryEditor } from "./entryeditor.js";
import { openDrawer, closeDrawer, wireDrawer, fromKeyboard } from "./drawer.js";

const dlg = document.getElementById("diary");
const q = (s) => dlg.querySelector(s);
const todayHeading = q(".dy-today-h");
const grid = q(".dy-grid");
const monthTitle = q(".dy-month-title");
const prevBtn = q(".dy-prev");
const nextBtn = q(".dy-next");
const summary = q(".dy-summary");
const list = q(".dy-list");
const moreBtn = q(".dy-more");

const editor = createEntryEditor(q(".dy-editor"), { placeholder: "Dear diary, today…" });

const PAGE = 15;
let month = null;   // first day of the month being shown
let showing = PAGE; // how many past entries are listed

export function openDiary({ instant = false } = {}) {
  const now = new Date();
  month = new Date(now.getFullYear(), now.getMonth(), 1);
  showing = PAGE;
  todayHeading.textContent = `How's today? · ${DAYS[now.getDay()].slice(0, 3)} ${now.getDate()} ${MONTHS[now.getMonth()].slice(0, 3)}`;
  editor.setDay(now);
  render();
  openDrawer(dlg, { instant });
}

function render() {
  renderMonth();
  renderEntries();
}

function renderMonth() {
  const y = month.getFullYear(), m = month.getMonth();
  const now = new Date();
  const todayKey = store.dateKey(now);
  monthTitle.textContent = `${MONTHS[m]} ${y}`;
  nextBtn.disabled = y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth());

  const counts = {};
  const cells = WEEK.map((d) => `<span class="dy-dow" aria-hidden="true">${DAYS[d][0]}</span>`);
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  for (let i = 0; i < offset; i++) cells.push('<span class="dy-blank"></span>');
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const key = store.dateKey(date);
    const e = store.entryOn(date);
    const mood = e?.mood;
    const hasNote = !!e?.note.trim();
    if (mood) counts[mood] = (counts[mood] || 0) + 1;
    const future = key > todayKey;
    const label = `${DAYS[date.getDay()]} ${d} ${MONTHS[m]}` +
      (mood ? `, ${moodOf(mood).label}` : "") + (hasNote ? ", has a note" : "");
    const cls = ["dy-day", key === todayKey && "is-today", future && "is-future", mood && "has-mood"].filter(Boolean).join(" ");
    cells.push(`<button type="button" class="${cls}" data-key="${key}" aria-label="${label}"${future ? " disabled" : ""}>${
      mood ? moodFace(mood) : `<span class="dy-num">${d}</span>`}${!mood && hasNote ? '<span class="dy-dot"></span>' : ""}</button>`);
  }
  grid.innerHTML = cells.join("");

  const used = MOODS.filter((md) => counts[md.id]);
  summary.innerHTML = used.length
    ? used.map((md) => `<span class="dy-count" title="${md.label}">${moodFace(md.id)}<b>${counts[md.id]}</b><span class="sr-only"> ${md.label}</span></span>`).join("")
    : '<span class="np-empty">No moods yet this month</span>';
}

function longDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}${sameYear ? "" : ` ${y}`}`;
}

function renderEntries() {
  const all = store.notedEntries();
  if (!all.length) {
    list.innerHTML = '<li class="np-empty">Your notes will collect here ✿</li>';
    moreBtn.hidden = true;
    return;
  }
  list.replaceChildren(...all.slice(0, showing).map((e) => {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="dy-entry" data-key="${e.date}">
      <span class="dy-entry-head">${e.mood ? moodFace(e.mood) : ""}<span class="dy-date"></span></span>
      <span class="dy-text"></span></button>`;
    li.querySelector(".dy-date").textContent = longDate(e.date);
    li.querySelector(".dy-text").textContent = e.note.trim();
    return li;
  }));
  moreBtn.hidden = all.length <= showing;
}

// tap a day (in the month or a past entry): open it on the calendar
function openDayFromDiary(key, e) {
  const instant = fromKeyboard(e);
  editor.flush();
  closeDrawer(dlg, { instant });
  document.dispatchEvent(new CustomEvent("vida:open-day", { detail: { key, instant } }));
}
grid.addEventListener("click", (e) => {
  const b = e.target.closest(".dy-day");
  if (b && !b.disabled) openDayFromDiary(b.dataset.key, e);
});
list.addEventListener("click", (e) => {
  const b = e.target.closest(".dy-entry");
  if (b) openDayFromDiary(b.dataset.key, e);
});

prevBtn.addEventListener("click", () => {
  month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  renderMonth();
});
nextBtn.addEventListener("click", () => {
  if (nextBtn.disabled) return;
  month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  renderMonth();
  if (nextBtn.disabled) prevBtn.focus(); // don't leave focus on a disabled button
});
moreBtn.addEventListener("click", () => {
  showing += PAGE;
  renderEntries();
});

wireDrawer(dlg);
store.subscribe(() => { if (dlg.open) render(); });
