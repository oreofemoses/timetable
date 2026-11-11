// "When?" for a to-do: Today / Tomorrow / Someday, or pick a day.
// get() gives a "2026-11-12" key, or null for someday.
import { dateKey } from "./store.js";

let count = 0;
const keyIn = (days) => {
  const d = new Date();
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

export function createWhen(container) {
  const name = `when-${++count}`;
  container.classList.add("when");
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "When?");
  container.innerHTML = `
    <label class="when-chip"><input type="radio" name="${name}" value="today"><span>Today</span></label>
    <label class="when-chip"><input type="radio" name="${name}" value="tomorrow"><span>Tomorrow</span></label>
    <label class="when-chip"><input type="radio" name="${name}" value="someday"><span>Someday</span></label>
    <input type="date" class="field when-date" aria-label="Pick a day" />`;
  const radios = [...container.querySelectorAll("input[type=radio]")];
  const dateInput = container.querySelector(".when-date");

  const showDate = (on) => container.classList.toggle("has-date", on);
  radios.forEach((r) => r.addEventListener("change", () => { dateInput.value = ""; showDate(false); }));
  dateInput.addEventListener("change", () => {
    if (!dateInput.value) return;
    radios.forEach((r) => { r.checked = false; });
    showDate(true);
  });

  function get() {
    if (dateInput.value) return dateInput.value;
    const v = radios.find((r) => r.checked)?.value ?? "today";
    if (v === "someday") return null;
    return keyIn(v === "tomorrow" ? 1 : 0);
  }

  function set(key) {
    radios.forEach((r) => { r.checked = false; });
    dateInput.value = "";
    const pick = key === null ? "someday" : key === keyIn(0) ? "today" : key === keyIn(1) ? "tomorrow" : null;
    if (pick) radios.find((r) => r.value === pick).checked = true;
    else dateInput.value = key;
    showDate(!pick);
  }

  return { get, set };
}
