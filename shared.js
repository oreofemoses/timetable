// Bits used by both the calendar and the day notepad.

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// one pastel header colour per month
export const HEADS = ["#9fcfff", "#ff9fb6", "#8fdcbc", "#c2acf7", "#ffd66e", "#ffb48a",
  "#8fd0f0", "#ff9fb6", "#f7c26b", "#ff9f80", "#e6a1d8", "#9fb8f7"];

// kinds of plan, each with its own little sticker
export const TYPES = [
  { id: "class", label: "Class", color: "#b7dbff",
    icon: '<path d="M4.5 6.5c1.8-.9 3.7-.9 5.5 0v8c-1.8-.9-3.7-.9-5.5 0zM10 6.5c1.8-.9 3.7-.9 5.5 0v8c-1.8-.9-3.7-.9-5.5 0z"/>' },
  { id: "work", label: "Work", color: "#ffe08a",
    icon: '<rect x="4.5" y="7.5" width="11" height="7.5" rx="1.5"/><path d="M8 7.5V6h4v1.5"/>' },
  { id: "gym", label: "Gym", color: "#b4e9d4",
    icon: '<path d="M5 8.2v3.6M7.4 6.6v6.8M12.6 6.6v6.8M15 8.2v3.6M7.4 10h5.2"/>' },
  { id: "appointment", label: "Appointment", color: "#d3c3fb",
    icon: '<circle cx="10" cy="10" r="5.2"/><path d="M10 7.4V10l1.9 1.3"/>' },
  { id: "friends", label: "Friends", color: "#ffb3c7",
    icon: '<path d="M10 14.6s-4.8-2.9-4.8-6a2.5 2.5 0 0 1 4.8-1 2.5 2.5 0 0 1 4.8 1c0 3.1-4.8 6-4.8 6z"/>' },
  { id: "other", label: "Other", color: "#ffc7a1",
    icon: '<path d="M10 4.9l1.5 3.2 3.5.4-2.6 2.4.7 3.5L10 12.7l-3.1 1.7.7-3.5L5 8.5l3.5-.4z"/>' },
];
export const typeOf = (id) => TYPES.find((t) => t.id === id) || TYPES[TYPES.length - 1];

export function sticker(typeId) {
  const t = typeOf(typeId);
  return `<svg class="sticker" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="${t.color}"/><g fill="none">${t.icon}</g></svg>`;
}

export const CHECK_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.5"/></svg>';
export const CROSS_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8"/></svg>';

// "14:30" → "2:30pm" (or the 24h style if that's what her phone uses)
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return timeFmt.format(new Date(2000, 0, 1, h, m)).replace(/\s?([AP]M)$/i, (s) => s.trim().toLowerCase());
}
export function timeRange(plan) {
  if (!plan.start) return "";
  return plan.end ? `${formatTime(plan.start)} – ${formatTime(plan.end)}` : formatTime(plan.start);
}

// moods for the diary, each a little face
export const MOODS = [
  { id: "great", label: "Great", color: "#ffb3c7" },
  { id: "good", label: "Good", color: "#b4e9d4" },
  { id: "okay", label: "Okay", color: "#ffe08a" },
  { id: "low", label: "Low", color: "#b7dbff" },
  { id: "rough", label: "Rough", color: "#d3c3fb" },
];
const FACES = {
  great: '<path d="M12.5 17.5q2.2-3 4.4 0M23.1 17.5q2.2-3 4.4 0"/><path class="mouth-fill" d="M12.5 22.5h15q-1 7.5-7.5 7.5t-7.5-7.5z"/><circle class="cheek" cx="10" cy="23" r="2.3"/><circle class="cheek" cx="30" cy="23" r="2.3"/>',
  good: '<circle class="dot" cx="14.5" cy="17" r="1.9"/><circle class="dot" cx="25.5" cy="17" r="1.9"/><path d="M13.5 23.5q6.5 6 13 0"/><circle class="cheek" cx="10.5" cy="22" r="2"/><circle class="cheek" cx="29.5" cy="22" r="2"/>',
  okay: '<circle class="dot" cx="14.5" cy="17.5" r="1.9"/><circle class="dot" cx="25.5" cy="17.5" r="1.9"/><path d="M15 25.5h10"/>',
  low: '<circle class="dot" cx="14.5" cy="18.5" r="1.9"/><circle class="dot" cx="25.5" cy="18.5" r="1.9"/><path d="M14 28q6-5 12 0"/><path d="M11.5 14l4.5-1.6M28.5 14l-4.5-1.6"/>',
  rough: '<path d="M12 17.5q2.5 2.2 5 0M23 17.5q2.5 2.2 5 0"/><path d="M12.5 27.5q1.9-2 3.75 0t3.75 0t3.75 0t3.75 0"/><path class="tear" d="M29 20.5q2.2 3.2 0 4.6q-2.2-1.4 0-4.6z"/>',
};
export const moodOf = (id) => MOODS.find((m) => m.id === id) || null;
export function moodFace(id) {
  const m = moodOf(id);
  if (!m) return "";
  // "mood-face", not "face": .face is the calendar page itself
  return `<svg class="mood-face" viewBox="0 0 40 40" aria-hidden="true"><circle class="skin" cx="20" cy="20" r="17" fill="${m.color}"/>${FACES[id]}</svg>`;
}
export const NOTE_SVG = '<svg class="note-ico" viewBox="0 0 24 24" aria-hidden="true"><path class="paper" d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M15 3.5V7h3.5M9 11h6.5M9 14.5h6.5M9 18h4"/></svg>';

// a little alarm clock, for reminders
export const BELL_SVG = '<svg class="bell" viewBox="0 0 24 24" aria-hidden="true"><path class="bell-ears" d="M4.2 8a3.2 3.2 0 0 1 4.3-4.4zM19.8 8a3.2 3.2 0 0 0-4.3-4.4z"/><path d="M7.6 20.2l1.3-1.7M16.4 20.2l-1.3-1.7"/><circle cx="12" cy="13" r="7"/><path d="M12 9.6V13l2.4 1.6"/></svg>';

// "Today, 6:00pm" / "Tomorrow, 9:00am" / "Fri 14 Nov, 9:00am"
export function whenLabel(d) {
  const t = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
  const time = formatTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday"
    : `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${day}, ${time}`;
}

// "Vida" → "Vida's Timetable", "James" → "James' Timetable", "" → "My Timetable"
// (index.html has a tiny copy of this so the right title shows before the app loads)
export function appTitle(name) {
  const n = (name || "").trim();
  if (!n) return "My Timetable";
  return `${n}${/s$/i.test(n) ? "'" : "'s"} Timetable`;
}

// the week as she reads it: Monday first
export const WEEK = [1, 2, 3, 4, 5, 6, 0];
const SHORT = (d) => DAYS[d].slice(0, 3);

// [1, 3] → "every Mon & Wed"; [1..5] → "weekdays"
export function daysText(days) {
  const s = WEEK.filter((d) => days.includes(d));
  if (s.length === 7) return "every day";
  if (s.length === 5 && [1, 2, 3, 4, 5].every((d) => s.includes(d))) return "weekdays";
  if (s.length === 2 && s.includes(0) && s.includes(6)) return "weekends";
  const names = s.map(SHORT);
  return "every " + (names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}` : names[0]);
}

// "2026-12-05" → "5 Dec"
export function shortDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

// anything she types goes through this before it is put into HTML
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
