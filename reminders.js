// The reminders panel (alarm clock icon): set a reminder for a day and
// time, once / every day / every week, and see what's ringing or coming up.
import { DAYS, BELL_SVG, CROSS_SVG, whenLabel } from "./shared.js";
import * as store from "./store.js";
import { chimeOn, setChime } from "./prefs.js";
import { openDrawer, wireDrawer } from "./drawer.js";

const dlg = document.getElementById("reminders");
const q = (s) => dlg.querySelector(s);
const subEl = q(".np-sub");
const addForm = q(".rm-add");
const f = addForm.elements;
const ringingSec = q(".rm-ringing");
const ringingUl = q(".rm-ringing ul");
const upUl = q(".rm-upcoming ul");
const soundBox = q(".rm-sound input");

let editingId = null;

const pad = (n) => String(n).padStart(2, "0");
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const repeatLabel = (r) => (r.repeat === "daily" ? "every day"
  : r.repeat === "weekly" ? `every ${DAYS[store.atToDate(r.at).getDay()]}` : "");

function setWhen(d) {
  f.date.value = store.dateKey(d);
  f.time.value = hhmm(d);
  f.time.setCustomValidity("");
}
function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function invalid(input, message) {
  input.setCustomValidity(message);
  input.reportValidity();
}

// ---------- open ----------
export function openReminders({ instant = false } = {}) {
  editingId = null;
  f.text.value = "";
  f.repeat.value = "once";
  setWhen(nextHour());
  soundBox.checked = chimeOn();
  render();
  openDrawer(dlg, { instant });
}

// the alarm engine calls this when something starts ringing
export function refreshReminders() {
  if (dlg.open) render();
}

// ---------- lists ----------
function render() {
  const now = Date.now();
  const due = store.remindersDue(now);
  const up = store.remindersUpcoming(now);
  ringingSec.hidden = !due.length;
  fill(ringingUl, due, true);
  fill(upUl, up, false, "Nothing coming up ✿");
  subEl.textContent = due.length ? `${due.length} ringing now`
    : up.length ? `Next: ${up[0].text} · ${whenLabel(store.dueAt(up[0]))}` : "Nothing coming up";
}

function fill(ul, items, ringing, emptyText = "") {
  if (!items.length) {
    ul.innerHTML = emptyText ? `<li class="np-empty">${emptyText}</li>` : "";
    return;
  }
  const active = document.activeElement;
  const refocus = ul.contains(active) && active.closest(".rm-item")?.dataset.id;
  ul.replaceChildren(...items.map((r) => (r.id === editingId ? editorItem(r) : item(r, ringing))));
  if (refocus && refocus !== editingId) ul.querySelector(`[data-id="${refocus}"] .rm-txt`)?.focus();
}

function item(r, ringing) {
  const li = document.createElement("li");
  li.className = "rm-item";
  li.dataset.id = r.id;
  li.innerHTML = `${BELL_SVG}
    <button type="button" class="rm-txt"><span class="rm-text"></span><small class="rm-meta"></small></button>
    ${ringing
      ? '<div class="rm-actions"><button type="button" class="btn rm-snooze">Snooze</button><button type="button" class="btn btn-today rm-done">Done</button></div>'
      : `<button type="button" class="todo-del rm-del">${CROSS_SVG}</button>`}`;
  li.querySelector(".rm-text").textContent = r.text;
  li.querySelector(".rm-meta").textContent =
    [whenLabel(store.dueAt(r)), r.snooze && "snoozed", repeatLabel(r)].filter(Boolean).join(" · ");
  li.querySelector(".rm-txt").setAttribute("aria-label", `Edit “${r.text}”`);
  li.querySelector(".rm-del")?.setAttribute("aria-label", `Delete “${r.text}”`);
  return li;
}

function editorItem(r) {
  const li = document.createElement("li");
  li.className = "rm-item editing";
  li.dataset.id = r.id;
  const [date, time] = r.at.split("T");
  li.innerHTML = `
    <form class="rm-edit">
      <input class="field" name="text" maxlength="120" required autocomplete="off" aria-label="Reminder" />
      <div class="time-row">
        <label>Day <input class="field" type="date" name="date" /></label>
        <label>Time <input class="field" type="time" name="time" /></label>
      </div>
      <div class="when" role="radiogroup" aria-label="Repeat">
        <label class="when-chip"><input type="radio" name="erepeat" value="once"><span>Once</span></label>
        <label class="when-chip"><input type="radio" name="erepeat" value="daily"><span>Every day</span></label>
        <label class="when-chip"><input type="radio" name="erepeat" value="weekly"><span>Every week</span></label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-delete">Delete</button>
        <button type="button" class="btn rm-cancel">Cancel</button>
        <button type="submit" class="btn btn-next">Save</button>
      </div>
    </form>`;
  const ef = li.querySelector("form").elements;
  ef.text.value = r.text;
  ef.date.value = date;
  ef.time.value = time;
  ef.erepeat.value = r.repeat || "once";
  return li;
}

function startEdit(id) {
  editingId = id;
  render();
  dlg.querySelector(`.rm-item[data-id="${id}"] input[name=text]`)?.focus();
}
function cancelEdit() {
  if (!editingId) return false;
  const id = editingId;
  editingId = null;
  render();
  dlg.querySelector(`.rm-item[data-id="${id}"] .rm-txt`)?.focus();
  return true;
}

// ---------- events ----------
q(".rm-quick").addEventListener("click", (e) => {
  const b = e.target.closest("[data-quick]");
  if (!b) return;
  const now = new Date();
  let d;
  if (b.dataset.quick === "hour") {
    d = new Date(now.getTime() + 60 * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  } else if (b.dataset.quick === "evening") {
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0);
    if (d - now < 30 * 60000) d.setDate(d.getDate() + 1); // too late for tonight: tomorrow evening
  } else {
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  }
  setWhen(d);
});
addForm.addEventListener("input", (e) => e.target.setCustomValidity?.(""));

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = f.text.value.trim();
  if (!text) { invalid(f.text, "What should I remind you about?"); return; }
  if (!f.date.value || !f.time.value) { invalid(f.time, "Pick a time"); return; }
  const at = `${f.date.value}T${f.time.value}`;
  const repeat = f.repeat.value === "once" ? null : f.repeat.value;
  if (!repeat && store.atToDate(at).getTime() <= Date.now()) {
    invalid(f.time, "That time has already passed");
    return;
  }
  store.addReminder({ text, at, repeat });
  f.text.value = "";
  f.text.focus(); // ready for another
});

dlg.addEventListener("click", (e) => {
  const li = e.target.closest(".rm-item");
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest(".rm-txt")) startEdit(id);
  else if (e.target.closest(".rm-del")) store.deleteReminder(id);
  else if (e.target.closest(".rm-snooze")) store.snoozeReminder(id, 10);
  else if (e.target.closest(".rm-done")) store.dismissReminder(id);
  else if (e.target.closest(".rm-cancel")) cancelEdit();
  else if (e.target.closest(".btn-delete")) { editingId = null; store.deleteReminder(id); f.text.focus(); }
});

dlg.addEventListener("submit", (e) => {
  if (!e.target.matches(".rm-edit")) return;
  e.preventDefault();
  const ef = e.target.elements;
  const text = ef.text.value.trim();
  if (!text) return;
  const at = `${ef.date.value}T${ef.time.value}`;
  const repeat = ef.erepeat.value === "once" ? null : ef.erepeat.value;
  if (!ef.date.value || !ef.time.value) { invalid(ef.time, "Pick a time"); return; }
  if (!repeat && store.atToDate(at).getTime() <= Date.now()) {
    invalid(ef.time, "That time has already passed");
    return;
  }
  const id = editingId;
  editingId = null;
  store.updateReminder(id, { text, at, repeat });
  dlg.querySelector(`.rm-item[data-id="${id}"] .rm-txt`)?.focus();
});
dlg.addEventListener("input", (e) => { if (e.target.closest(".rm-edit")) e.target.setCustomValidity?.(""); });

soundBox.addEventListener("change", () => setChime(soundBox.checked));

wireDrawer(dlg, { onEscape: cancelEdit });
store.subscribe(() => { if (dlg.open) render(); });
