// The to-do panel (sticky-note icon): everything she has to do, in four
// sections: left from before, today, coming up, and someday.
import { DAYS, MONTHS } from "./shared.js";
import * as store from "./store.js";
import { createTodoList } from "./todolist.js";
import { createWhen } from "./whenpicker.js";
import { openDrawer, wireDrawer } from "./drawer.js";

const dlg = document.getElementById("todos");
const q = (s) => dlg.querySelector(s);
const subEl = q(".np-sub");
const addForm = q(".td-add");
const addInput = addForm.querySelector("input[name=text]");
const when = createWhen(q(".td-when"));
const moveAllBtn = q(".td-move-all");

const afterDelete = () => addInput.focus({ preventScroll: true });
const section = (cls, emptyText = "") => ({
  el: q(cls),
  list: createTodoList(q(`${cls} ul`), { emptyText, afterDelete }),
});
const sections = {
  overdue: section(".td-overdue"),
  today: section(".td-today", "Nothing for today yet ✿"),
  upcoming: section(".td-upcoming"),
  someday: section(".td-someday"),
};

let overdueIds = [];

const todayKey = () => store.dateKey(new Date());
const keyIn = (days) => {
  const d = new Date();
  return store.dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

// "Tomorrow", "Yesterday", or "Fri 14 Nov"
function dayTag(key) {
  if (key === keyIn(1)) return "Tomorrow";
  if (key === keyIn(-1)) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()].slice(0, 3)} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

export function openTodos({ instant = false } = {}) {
  when.set(todayKey());
  render();
  openDrawer(dlg, { instant });
}

function render() {
  const b = store.todoBuckets(todayKey());
  overdueIds = b.overdue.map((t) => t.id);
  const tag = (t) => dayTag(t.date);

  sections.overdue.el.hidden = !b.overdue.length;
  sections.overdue.list.render(b.overdue, { tag });
  sections.today.list.render(b.today);
  sections.upcoming.el.hidden = !b.upcoming.length;
  sections.upcoming.list.render(b.upcoming, { tag });
  sections.someday.el.hidden = !b.someday.length;
  sections.someday.list.render(b.someday);

  const left = b.today.filter((t) => !t.done).length;
  subEl.textContent = left || b.overdue.length
    ? [left && `${left} left today`, b.overdue.length && `${b.overdue.length} from before`].filter(Boolean).join(" · ")
    : b.today.length ? "All done for today ✿" : "A fresh page";
}

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = addInput.value.trim();
  if (!text) return;
  store.addTodo(text, when.get());
  addInput.value = "";
  addInput.focus(); // ready for the next one; "when" stays as she set it
});

moveAllBtn.addEventListener("click", () => store.moveTodos(overdueIds, todayKey()));

// Escape cancels an edit first, then closes the panel
wireDrawer(dlg, {
  onEscape: () => Object.values(sections).some((s) => s.list.cancelEdit()),
});

store.subscribe(() => { if (dlg.open) render(); });
