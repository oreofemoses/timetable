// "My week": the things that happen every week, Monday to Sunday.
// Anything added here is written on every matching calendar page.
import { DAYS, WEEK, typeOf, sticker, timeRange, shortDate } from "./shared.js";
import * as store from "./store.js";
import { createPlanForm } from "./planform.js";
import { openDrawer, wireDrawer } from "./drawer.js";

const dlg = document.getElementById("schedule");
const weekEl = dlg.querySelector(".week");
const listView = dlg.querySelector(".wk-view");
const formView = dlg.querySelector(".wk-form");
const formTitle = dlg.querySelector(".wk-form-title");
const paper = dlg.querySelector(".np-paper");

let returnFocus = null; // where to put focus back after the form closes

const planForm = createPlanForm({ onClose: showList });
formView.append(planForm.el);

export function openSchedule({ instant = false } = {}) {
  showList();
  openDrawer(dlg, { instant });
}

function showList() {
  planForm.close();
  formView.hidden = true;
  listView.hidden = false;
  render();
  if (returnFocus && dlg.open) {
    weekEl.querySelector(returnFocus)?.focus();
    returnFocus = null;
  }
}

function showForm(plan, dow) {
  returnFocus = plan ? `.wk-card[data-id="${plan.id}"]` : `.wk-add[data-dow="${dow}"]`;
  listView.hidden = true;
  formView.hidden = false;
  formTitle.textContent = plan ? `Edit “${plan.title}”` : `Add to ${DAYS[dow]}s`;
  planForm.open(plan, { mode: "week", days: plan ? undefined : [dow] });
  paper.scrollTop = 0;
}

function cardMeta(p) {
  const today = store.dateKey(new Date());
  const bits = [timeRange(p) || "any time"];
  if (p.repeat.from > today) bits.push(`from ${shortDate(p.repeat.from)}`);
  if (p.repeat.until) bits.push(`until ${shortDate(p.repeat.until)}`);
  return bits.join(" · ");
}

function render() {
  const plans = store.weeklyPlans();
  const todayDow = new Date().getDay();
  weekEl.replaceChildren(...WEEK.map((dow) => {
    const col = document.createElement("section");
    col.className = "wk-day" + (dow === todayDow ? " is-today" : "");
    col.setAttribute("aria-label", DAYS[dow]);
    col.innerHTML = `<h3>${DAYS[dow]}</h3><ul class="wk-list"></ul>
      <button type="button" class="wk-add" data-dow="${dow}" aria-label="Add something every ${DAYS[dow]}">+ Add</button>`;
    const list = col.querySelector(".wk-list");
    for (const p of plans.filter((p) => p.repeat.days.includes(dow))) {
      const li = document.createElement("li");
      li.innerHTML = `<button type="button" class="wk-card" style="--chip:${typeOf(p.type).color}">
        ${sticker(p.type)}<span class="wk-text"><span class="wk-title"></span><span class="wk-meta"></span></span></button>`;
      const card = li.firstElementChild;
      card.dataset.id = p.id;
      card.querySelector(".wk-title").textContent = p.title;
      card.querySelector(".wk-meta").textContent = cardMeta(p);
      list.append(li);
    }
    return col;
  }));
}

weekEl.addEventListener("click", (e) => {
  const card = e.target.closest(".wk-card");
  if (card) { showForm(store.getPlan(card.dataset.id)); return; }
  const add = e.target.closest(".wk-add");
  if (add) showForm(null, Number(add.dataset.dow));
});

// Escape closes the form first, then the week view
wireDrawer(dlg, {
  onEscape: () => {
    if (formView.hidden) return false;
    showList();
    return true;
  },
});

store.subscribe(() => { if (dlg.open && !listView.hidden) render(); });
