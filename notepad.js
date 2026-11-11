// The day notepad: tap a calendar page and a notepad slides up with that
// day's plans and to-dos, where she can add, edit and tick things off.
import { MONTHS, DAYS, HEADS, typeOf, sticker, timeRange, daysText } from "./shared.js";
import * as store from "./store.js";
import { createPlanForm } from "./planform.js";
import { createTodoList } from "./todolist.js";
import { createEntryEditor } from "./entryeditor.js";
import { openDrawer, wireDrawer } from "./drawer.js";

const dlg = document.getElementById("notepad");
const q = (s) => dlg.querySelector(s);
const titleEl = q("#np-title");
const subEl = q(".np-sub");
const plansUl = q(".np-plans");
const todosUl = q(".np-todos");
const addPlanBtn = q(".np-add-plan");
const todoForm = q(".todo-form");
const todoInput = todoForm.querySelector("input");

let day = null; // the Date this notepad is showing

const planForm = createPlanForm({
  onClose: () => {
    addPlanBtn.hidden = false;
    renderPlans();
    addPlanBtn.focus();
  },
});
addPlanBtn.after(planForm.el);

const todoList = createTodoList(todosUl, {
  emptyText: "No to-dos. Lovely!",
  afterDelete: () => todoInput.focus({ preventScroll: true }),
});

const diaryHeading = q("#np-diary-h");
const entry = createEntryEditor(q(".np-entry"));

// ---------- open / close ----------
export const isNotepadOpen = () => dlg.open;

export function openDay(d, { instant = false } = {}) {
  day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  dlg.style.setProperty("--head", HEADS[day.getMonth()]);
  titleEl.textContent = DAYS[day.getDay()];
  subEl.textContent = `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;
  planForm.close();
  addPlanBtn.hidden = false;
  render();

  // mood + note: no mood for days that haven't happened yet
  const key = store.dateKey(day), todayKey = store.dateKey(new Date());
  diaryHeading.textContent = key === todayKey ? "How's today?" : key < todayKey ? "How was the day?" : "Notes";
  entry.setDay(day, { moods: key <= todayKey });

  openDrawer(dlg, { instant });
}

// Escape closes an open form first (plan or to-do edit), then the notepad
wireDrawer(dlg, {
  onEscape: () => {
    if (todoList.cancelEdit()) return true;
    if (!planForm.isOpen()) return false;
    planForm.close();
    addPlanBtn.hidden = false;
    renderPlans();
    addPlanBtn.focus();
    return true;
  },
});

// ---------- lists ----------
function render() {
  renderPlans();
  renderTodos();
}

function renderPlans() {
  const plans = store.plansOn(day);
  if (!plans.length) {
    plansUl.innerHTML = '<li class="np-empty">Nothing planned yet ✿</li>';
    return;
  }
  const editing = planForm.editingId();
  plansUl.replaceChildren(...plans.map((p) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "plan-row" + (p.id === editing ? " editing" : "");
    b.dataset.id = p.id;
    b.innerHTML = `${sticker(p.type)}<span class="pr-title"></span><span class="pr-meta"></span>`;
    b.querySelector(".pr-title").textContent = p.title;
    b.querySelector(".pr-meta").textContent =
      [timeRange(p), p.place, p.repeat && daysText(p.repeat.days)].filter(Boolean).join(" · ")
      || typeOf(p.type).label;
    li.append(b);
    return li;
  }));
}

function renderTodos() {
  todoList.render(store.todosOn(day));
}

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;
  store.addTodo(text, day);
  todoInput.value = "";
  todoInput.focus(); // ready for the next one
});

// ---------- add / edit a plan ----------
function openForm(plan) {
  planForm.open(plan, { mode: "day", date: day });
  addPlanBtn.hidden = true;
  renderPlans();
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  planForm.el.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
}

addPlanBtn.addEventListener("click", () => openForm(null));
plansUl.addEventListener("click", (e) => {
  const row = e.target.closest(".plan-row");
  if (row) openForm(store.getPlan(row.dataset.id));
});

store.subscribe(() => { if (dlg.open && day) render(); });
