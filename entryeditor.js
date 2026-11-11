// A day's mood + note. Used in the day notepad and the diary panel.
// The note saves itself half a second after she stops typing (and when she
// leaves the box, closes the panel, or switches away from the app).
import { MOODS, moodFace } from "./shared.js";
import * as store from "./store.js";

const editors = new Set();
const flushAll = () => editors.forEach((ed) => ed.flush());
document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
window.addEventListener("pagehide", flushAll);

export function createEntryEditor(container, { placeholder = "Dear diary…" } = {}) {
  container.classList.add("entry");
  container.innerHTML = `
    <div class="mood-pick" role="group" aria-label="How was the day?">
      ${MOODS.map((m) => `
        <button type="button" class="mood-btn" data-mood="${m.id}" aria-pressed="false">${moodFace(m.id)}<span>${m.label}</span></button>`).join("")}
    </div>
    <textarea class="field diary-note" rows="4" maxlength="4000" aria-label="Note for the day"></textarea>
    <p class="saved" aria-live="polite"></p>`;
  const pick = container.querySelector(".mood-pick");
  const box = container.querySelector("textarea");
  const savedEl = container.querySelector(".saved");
  box.placeholder = placeholder;

  let day = null;
  let dirty = false;
  let timer = 0;
  let savedTimer = 0;

  function refresh() {
    if (!day) return;
    const entry = store.entryOn(day);
    pick.querySelectorAll(".mood-btn").forEach((b) =>
      b.setAttribute("aria-pressed", String(entry?.mood === b.dataset.mood)));
    // never overwrite what she's in the middle of typing
    if (document.activeElement !== box && !dirty) box.value = entry?.note ?? "";
  }

  function flush() {
    clearTimeout(timer);
    if (!dirty || !day) return;
    dirty = false;
    store.setEntry(day, { note: box.value });
    savedEl.textContent = "Saved ✓";
    savedEl.classList.add("show");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => savedEl.classList.remove("show"), 1400);
  }

  box.addEventListener("input", () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  });
  box.addEventListener("blur", flush);
  container.closest("dialog")?.addEventListener("close", flush);

  // tap a face to pick it; tap it again to clear
  pick.addEventListener("click", (e) => {
    const b = e.target.closest(".mood-btn");
    if (!b || !day) return;
    flush();
    const current = store.entryOn(day)?.mood;
    store.setEntry(day, { mood: current === b.dataset.mood ? null : b.dataset.mood });
  });

  store.subscribe(refresh);

  const api = {
    setDay(d, { moods = true } = {}) {
      flush();
      day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      pick.hidden = !moods;
      box.value = store.entryOn(day)?.note ?? "";
      savedEl.classList.remove("show");
      refresh();
    },
    flush,
  };
  editors.add(api);
  return api;
}
