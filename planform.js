// The add / edit plan form, shared by the day notepad and the week view.
//
//   form.open(plan, { mode: "day", date })  from a calendar day
//   form.open(plan, { mode: "week", days }) from the week view (always weekly)
//
// When she edits a weekly plan from one day, she chooses whether the change
// is for "Just this day" or "Every week".
import { TYPES, DAYS, WEEK, sticker } from "./shared.js";
import * as store from "./store.js";

export function createPlanForm({ onClose }) {
  const form = document.createElement("form");
  form.className = "plan-form";
  form.hidden = true;
  form.innerHTML = `
    <div class="pf-scope" role="radiogroup" aria-label="Change which days?">
      <label class="seg"><input type="radio" name="scope" value="one"><span>Just this day</span></label>
      <label class="seg"><input type="radio" name="scope" value="all"><span>Every week</span></label>
    </div>
    <input class="field" name="what" required maxlength="80" autocomplete="off" placeholder="What's the plan?" aria-label="What's the plan?" />
    <fieldset class="type-pick">
      <legend class="sr-only">What kind of plan?</legend>
      ${TYPES.map((t) => `
        <label class="type-chip" style="--chip:${t.color}">
          <input type="radio" name="type" value="${t.id}">
          <span>${sticker(t.id)}${t.label}</span>
        </label>`).join("")}
    </fieldset>
    <div class="time-row">
      <label>Starts at <input class="field" type="time" name="start" /></label>
      <label>Ends at <input class="field" type="time" name="end" /></label>
    </div>
    <input class="field" name="place" maxlength="80" autocomplete="off" placeholder="Where? (optional)" aria-label="Where?" />
    <label class="repeat-toggle">
      <input type="checkbox" name="repeats" /><span class="switch" aria-hidden="true"></span>Happens every week
    </label>
    <div class="repeat-box">
      <span class="pf-label" aria-hidden="true">On</span>
      <fieldset class="dow-pick" aria-label="Repeats on">
        ${WEEK.map((d) => `
          <label class="dow-chip"><input type="checkbox" name="dow" value="${d}" aria-label="${DAYS[d]}"><span>${DAYS[d].slice(0, 2)}</span></label>`).join("")}
      </fieldset>
      <div class="time-row">
        <label>From <input class="field" type="date" name="from" /></label>
        <label>Until <span class="opt">(optional)</span><input class="field" type="date" name="until" /></label>
      </div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-delete">Delete</button>
      <button type="button" class="btn pf-cancel">Cancel</button>
      <button type="submit" class="btn btn-next pf-save">Add plan</button>
    </div>`;

  const f = form.elements;
  const scopeEl = form.querySelector(".pf-scope");
  const toggleEl = form.querySelector(".repeat-toggle");
  const repeatBox = form.querySelector(".repeat-box");
  const deleteBtn = form.querySelector(".btn-delete");
  const saveBtn = form.querySelector(".pf-save");
  const dowInputs = [...form.querySelectorAll("input[name=dow]")];

  let editing = null;
  let ctx = {};

  const justThisDay = () => !scopeEl.hidden && f.scope.value === "one";
  const checkedDays = () => dowInputs.filter((i) => i.checked).map((i) => Number(i.value));
  const setDays = (days) => dowInputs.forEach((i) => { i.checked = days.includes(Number(i.value)); });

  // show only what makes sense for the current choices
  function sync() {
    const one = justThisDay();
    toggleEl.hidden = ctx.mode === "week" || one;
    repeatBox.hidden = one || !f.repeats.checked;
    deleteBtn.hidden = !editing;
    deleteBtn.textContent = one ? "Skip this day" : editing?.repeat ? "Delete every week" : "Delete";
    saveBtn.textContent = editing ? "Save" : "Add plan";
  }

  function invalid(input, message) {
    input.setCustomValidity(message);
    input.reportValidity();
  }
  form.addEventListener("input", (e) => e.target.setCustomValidity?.(""));
  form.addEventListener("change", (e) => {
    if (e.target.name === "dow") dowInputs.forEach((i) => i.setCustomValidity(""));
    if (e.target.name === "scope" || e.target.name === "repeats") sync();
  });

  function open(plan, options = {}) {
    editing = plan || null;
    ctx = options;
    const r = editing?.repeat;
    const today = store.dateKey(new Date());
    f.what.value = editing?.title ?? "";
    f.type.value = editing?.type ?? "other";
    f.start.value = editing?.start ?? "";
    f.end.value = editing?.end ?? "";
    f.place.value = editing?.place ?? "";
    f.repeats.checked = ctx.mode === "week" || !!r;
    setDays(r ? r.days : ctx.days ?? (ctx.date ? [ctx.date.getDay()] : []));
    f.from.value = r?.from ?? (ctx.date ? store.dateKey(ctx.date) : today);
    f.until.value = r?.until ?? "";
    scopeEl.hidden = !(r && ctx.mode === "day" && ctx.date);
    f.scope.value = "all";
    [...form.elements].forEach((el) => el.setCustomValidity?.(""));
    sync();
    form.hidden = false;
    f.what.focus();
  }

  function close() {
    editing = null;
    form.hidden = true;
  }
  function finish() {
    close();
    onClose?.();
  }

  form.querySelector(".pf-cancel").addEventListener("click", finish);

  deleteBtn.addEventListener("click", () => {
    if (!editing) return;
    if (justThisDay()) store.skipDay(editing.id, store.dateKey(ctx.date));
    else store.deletePlan(editing.id);
    finish();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const base = {
      title: f.what.value, type: f.type.value || "other",
      start: f.start.value, end: f.end.value, place: f.place.value,
    };
    if (!base.title.trim()) { f.what.focus(); return; }
    if (base.start && base.end && base.end <= base.start) {
      invalid(f.end, "This ends before it starts");
      return;
    }

    if (justThisDay()) {
      store.replaceDay(editing.id, store.dateKey(ctx.date), base);
    } else if (f.repeats.checked) {
      const days = checkedDays();
      if (!days.length) { invalid(dowInputs[0], "Pick at least one day"); return; }
      if (!f.from.value) { invalid(f.from, "When does it start?"); return; }
      if (f.until.value && f.until.value < f.from.value) {
        invalid(f.until, "This ends before it starts");
        return;
      }
      const fields = { ...base, date: f.from.value, repeat: { days, from: f.from.value, until: f.until.value || null } };
      if (editing) store.updatePlan(editing.id, fields);
      else store.addPlan(fields);
    } else {
      const date = ctx.date ? store.dateKey(ctx.date) : editing?.date ?? store.dateKey(new Date());
      const fields = { ...base, date, repeat: null };
      if (editing) store.updatePlan(editing.id, fields);
      else store.addPlan(fields);
    }
    finish();
  });

  return {
    el: form,
    open,
    close,
    isOpen: () => !form.hidden,
    editingId: () => editing?.id ?? null,
  };
}
