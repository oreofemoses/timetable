// Everything Vida writes is kept here, saved on her device (localStorage).
// Each record has an id and updatedAt so syncing between devices can be
// added later without changing this shape.

const KEY = "vida-timetable";
const VERSION = 1;
const listeners = new Set();

const uid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const now = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, "0");

// a calendar day as "2026-11-12" (her local date, not UTC)
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const empty = () => ({ version: VERSION, plans: [], todos: [], entries: [], reminders: [] });
const list = (x) => (Array.isArray(x) ? x : []);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    if (!d || d.version !== VERSION) return empty();
    // entries (diary) and reminders arrived later; older saves simply don't have them yet
    return { version: VERSION, plans: list(d.plans), todos: list(d.todos), entries: list(d.entries),
      reminders: list(d.reminders) };
  } catch {
    return empty();
  }
}

let data = load();

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Couldn't save to this device", err);
  }
  listeners.forEach((fn) => fn());
}

// another tab changed the data: pick it up
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  data = load();
  listeners.forEach((fn) => fn());
});

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- plans ----------
// A plan is either one-off (date) or weekly:
//   repeat: { days: [1, 3], from: "2026-09-07", until: "2026-12-11" | null }
//   skip:   ["2026-11-17"]  ← days she cancelled just that once
const PLAN_FIELDS = ["title", "type", "date", "start", "end", "place", "note"];
const pick = (src, fields) => Object.fromEntries(
  fields.filter((f) => src[f] !== undefined).map((f) => [f, typeof src[f] === "string" ? src[f].trim() : src[f]]));
const isKey = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function cleanRepeat(r) {
  if (!r || !Array.isArray(r.days)) return null;
  const days = [...new Set(r.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  if (!days.length || !isKey(r.from)) return null;
  return { days, from: r.from, until: isKey(r.until) ? r.until : null };
}
function planFields(src) {
  const out = pick(src, PLAN_FIELDS);
  if ("repeat" in src) out.repeat = cleanRepeat(src.repeat);
  return out;
}
function makePlan(fields) {
  const t = now();
  return {
    id: uid(), title: "", type: "other", date: null, start: "", end: "", place: "", note: "",
    repeat: null, skip: [], createdAt: t, updatedAt: t,
    ...planFields(fields),
  };
}

const byTime = (a, b) => (a.start || "99:99").localeCompare(b.start || "99:99")
  || a.createdAt.localeCompare(b.createdAt);

// does this weekly plan happen on this day?
function happensOn(p, key, dow) {
  const r = p.repeat;
  return r.days.includes(dow) && key >= r.from && (!r.until || key <= r.until)
    && !(p.skip || []).includes(key);
}

export function plansOn(day) {
  const k = dateKey(day), dow = day.getDay();
  return data.plans.filter((p) => (p.repeat ? happensOn(p, k, dow) : p.date === k)).sort(byTime);
}

// everything that repeats and hasn't finished yet, for the week view
export function weeklyPlans() {
  const today = dateKey(new Date());
  return data.plans.filter((p) => p.repeat && (!p.repeat.until || p.repeat.until >= today)).sort(byTime);
}

export const getPlan = (id) => data.plans.find((p) => p.id === id) || null;

export function addPlan(fields) {
  const plan = makePlan(fields);
  data.plans.push(plan);
  commit();
  return plan;
}

export function updatePlan(id, fields) {
  const plan = getPlan(id);
  if (!plan) return;
  Object.assign(plan, planFields(fields), { updatedAt: now() });
  commit();
}

// a weekly plan doesn't happen on this one day
export function skipDay(id, key) {
  const plan = getPlan(id);
  if (!plan) return;
  plan.skip = [...new Set([...(plan.skip || []), key])];
  plan.updatedAt = now();
  commit();
}

// change a weekly plan for this one day only: skip it there, and put a
// one-off copy with her changes on that day instead
export function replaceDay(id, key, fields) {
  const plan = getPlan(id);
  if (!plan) return;
  plan.skip = [...new Set([...(plan.skip || []), key])];
  plan.updatedAt = now();
  data.plans.push(makePlan({ ...fields, date: key, repeat: null }));
  commit();
}

export function deletePlan(id) {
  data.plans = data.plans.filter((p) => p.id !== id);
  commit();
}

// ---------- to-dos ----------
// kept in the order she added them; the day page puts unfinished ones first
export function todosOn(day) {
  const k = dateKey(day);
  return data.todos.filter((t) => t.date === k)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// day: a Date, a "2026-11-12" key, or null for "someday"
const toKey = (day) => (day instanceof Date ? dateKey(day) : isKey(day) ? day : null);

export function addTodo(text, day) {
  const t = now();
  const todo = { id: uid(), text: text.trim(), done: false, date: toKey(day),
    createdAt: t, updatedAt: t, doneAt: null };
  data.todos.push(todo);
  commit();
  return todo;
}

export function updateTodo(id, { text, date }) {
  const todo = data.todos.find((t) => t.id === id);
  if (!todo) return;
  if (typeof text === "string" && text.trim()) todo.text = text.trim();
  if (date !== undefined) todo.date = toKey(date);
  todo.updatedAt = now();
  commit();
}

export function moveTodos(ids, day) {
  const key = toKey(day);
  for (const todo of data.todos) {
    if (ids.includes(todo.id)) { todo.date = key; todo.updatedAt = now(); }
  }
  commit();
}

// the to-do panel's sections, relative to today
export function todoBuckets(todayKey) {
  const byCreated = (a, b) => a.createdAt.localeCompare(b.createdAt);
  const byDate = (a, b) => a.date.localeCompare(b.date) || byCreated(a, b);
  const doneBeforeToday = (t) => t.done && t.doneAt && dateKey(new Date(t.doneAt)) < todayKey;
  const b = { overdue: [], today: [], upcoming: [], someday: [] };
  for (const t of data.todos) {
    if (t.date === null) { if (!doneBeforeToday(t)) b.someday.push(t); }
    else if (t.date < todayKey) { if (!t.done) b.overdue.push(t); }
    else if (t.date === todayKey) b.today.push(t);
    else b.upcoming.push(t);
  }
  b.overdue.sort(byDate); b.today.sort(byCreated); b.upcoming.sort(byDate); b.someday.sort(byCreated);
  return b;
}

// unfinished to-dos for today and earlier (the count on the sticky note)
export const openTodoCount = (todayKey) =>
  data.todos.filter((t) => !t.done && t.date && t.date <= todayKey).length;

// ---------- diary: one mood and one note per day ----------
const MOOD_IDS = ["great", "good", "okay", "low", "rough"];

export function entryOn(day) {
  const key = toKey(day);
  return data.entries.find((e) => e.date === key) || null;
}

// set the mood and/or note for a day; an entry with neither is removed
export function setEntry(day, fields) {
  const key = toKey(day);
  if (!key) return;
  const t = now();
  let entry = data.entries.find((e) => e.date === key);
  if (!entry) {
    entry = { id: uid(), date: key, mood: null, note: "", createdAt: t, updatedAt: t };
    data.entries.push(entry);
  }
  if ("mood" in fields) entry.mood = MOOD_IDS.includes(fields.mood) ? fields.mood : null;
  if ("note" in fields) entry.note = String(fields.note ?? "").slice(0, 4000);
  entry.updatedAt = t;
  if (!entry.mood && !entry.note.trim()) data.entries = data.entries.filter((e) => e !== entry);
  commit();
}

// days with something written, newest first
export const notedEntries = () =>
  data.entries.filter((e) => e.note.trim()).sort((a, b) => b.date.localeCompare(a.date));

// ---------- reminders ----------
// { text, at: "2026-11-12T18:00" (her local time), repeat: null | "daily" | "weekly",
//   snooze: same format or null, done }
// It rings when now reaches snooze (if set) or at.
const isAt = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);
const REPEATS = ["daily", "weekly"];

export function atToDate(at) {
  const [d, t] = at.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return new Date(y, m - 1, day, h, min);
}
export const dateToAt = (d) => `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dueAt = (r) => atToDate(r.snooze || r.at);

// the next time a repeating reminder happens after `afterMs`
function nextOccurrence(at, repeat, afterMs) {
  const step = repeat === "weekly" ? 7 : 1;
  let d = atToDate(at);
  while (d.getTime() <= afterMs) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + step, d.getHours(), d.getMinutes());
  return dateToAt(d);
}

const findReminder = (id) => data.reminders.find((r) => r.id === id) || null;
export const getReminder = findReminder;

export function addReminder({ text, at, repeat }) {
  if (!isAt(at) || !String(text || "").trim()) return null;
  const t = now();
  const r = { id: uid(), text: text.trim(), at, repeat: REPEATS.includes(repeat) ? repeat : null,
    snooze: null, done: false, doneAt: null, createdAt: t, updatedAt: t };
  // a repeating one set for a time that's already gone starts at its next turn
  if (r.repeat && atToDate(r.at).getTime() <= Date.now()) r.at = nextOccurrence(r.at, r.repeat, Date.now());
  data.reminders.push(r);
  commit();
  return r;
}

export function updateReminder(id, { text, at, repeat }) {
  const r = findReminder(id);
  if (!r) return;
  if (typeof text === "string" && text.trim()) r.text = text.trim();
  if (repeat !== undefined) r.repeat = REPEATS.includes(repeat) ? repeat : null;
  if (isAt(at)) {
    r.at = r.repeat && atToDate(at).getTime() <= Date.now() ? nextOccurrence(at, r.repeat, Date.now()) : at;
    r.snooze = null;
    r.done = false;
  }
  r.updatedAt = now();
  commit();
}

export function deleteReminder(id) {
  data.reminders = data.reminders.filter((r) => r.id !== id);
  commit();
}

// "Done": a one-off is finished; a repeating one moves on to its next turn
export function dismissReminder(id) {
  const r = findReminder(id);
  if (!r) return;
  r.snooze = null;
  if (r.repeat) r.at = nextOccurrence(r.at, r.repeat, Date.now());
  else { r.done = true; r.doneAt = now(); }
  r.updatedAt = now();
  commit();
}

export function snoozeReminder(id, minutes) {
  const r = findReminder(id);
  if (!r) return;
  r.snooze = dateToAt(new Date(Date.now() + minutes * 60000));
  r.updatedAt = now();
  commit();
}

// ---------- backup ----------
export const hasData = () =>
  data.plans.length + data.todos.length + data.entries.length + data.reminders.length > 0;
export const counts = (d = data) =>
  ({ plans: d.plans.length, todos: d.todos.length, entries: d.entries.length, reminders: d.reminders.length });

export function exportData() {
  return JSON.stringify({ app: "vida-timetable", exportedAt: new Date().toISOString(), ...data }, null, 2);
}

// Check a backup file before it replaces anything. Anything that doesn't
// look right is left out rather than allowed to break the app.
const str = (x) => typeof x === "string";
const VALID = {
  plans: (p) => str(p.id) && str(p.title) && str(p.createdAt) && (p.repeat ? !!cleanRepeat(p.repeat) : isKey(p.date)),
  todos: (t) => str(t.id) && str(t.text) && str(t.createdAt) && (t.date === null || isKey(t.date)),
  entries: (e) => str(e.id) && isKey(e.date) && str(e.note ?? ""),
  reminders: (r) => str(r.id) && str(r.text) && isAt(r.at),
};
export function readBackup(obj) {
  if (!obj || typeof obj !== "object" || obj.version !== VERSION) return null;
  const parts = Object.keys(VALID);
  if (!parts.some((k) => Array.isArray(obj[k]))) return null;
  const clean = { version: VERSION };
  for (const k of parts) {
    clean[k] = list(obj[k]).filter((x) => x && typeof x === "object" && VALID[k](x));
  }
  clean.plans.forEach((p) => { p.repeat = p.repeat ? cleanRepeat(p.repeat) : null; p.skip = list(p.skip); });
  clean.entries.forEach((e) => { e.note = e.note ?? ""; });
  return { data: clean, exportedAt: str(obj.exportedAt) ? obj.exportedAt : null };
}

// replace everything with a checked backup (keeping a safety copy of what was here)
export function replaceAll(clean) {
  try { localStorage.setItem(`${KEY}-before-restore`, JSON.stringify(data)); } catch { /* no room: carry on */ }
  data = clean;
  commit();
}

const byDue = (a, b) => dueAt(a) - dueAt(b);
// ringing right now (due and not done), oldest first
export const remindersDue = (nowMs) =>
  data.reminders.filter((r) => !r.done && dueAt(r).getTime() <= nowMs).sort(byDue);
// still to come, soonest first
export const remindersUpcoming = (nowMs) =>
  data.reminders.filter((r) => !r.done && dueAt(r).getTime() > nowMs).sort(byDue);

export function toggleTodo(id) {
  const todo = data.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = !todo.done;
  todo.doneAt = todo.done ? now() : null;
  todo.updatedAt = now();
  commit();
}

export function deleteTodo(id) {
  data.todos = data.todos.filter((t) => t.id !== id);
  commit();
}
