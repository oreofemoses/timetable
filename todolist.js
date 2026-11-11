// A list of to-dos: tick the box, tap the words to edit (or move to another
// day), ✕ to delete. Used by the day notepad and the to-do panel.
import { CHECK_SVG, CROSS_SVG } from "./shared.js";
import * as store from "./store.js";
import { createWhen } from "./whenpicker.js";

export function createTodoList(ul, { emptyText = "", afterDelete } = {}) {
  let editingId = null;
  let shown = [];          // the to-dos last rendered
  let tagFor = () => "";   // optional small date under each to-do

  function makeItem(t) {
    const li = document.createElement("li");
    li.className = "todo";
    li.dataset.id = t.id;
    if (t.id === editingId) {
      fillEditor(li, t);
      return li;
    }
    li.innerHTML = `
      <label class="todo-check"><input type="checkbox"><span class="box">${CHECK_SVG}</span></label>
      <button type="button" class="txt"><span></span><small class="todo-tag"></small></button>
      <button type="button" class="todo-del">${CROSS_SVG}</button>`;
    return li;
  }

  function paint(li, t) {
    if (li.classList.contains("editing")) return li;
    li.classList.toggle("done", t.done);
    const box = li.querySelector(".todo-check input");
    box.checked = t.done;
    box.setAttribute("aria-label", t.text);
    li.querySelector(".txt span").textContent = t.text;
    li.querySelector(".txt").setAttribute("aria-label", `Edit “${t.text}”`);
    const tag = tagFor(t);
    const tagEl = li.querySelector(".todo-tag");
    tagEl.textContent = tag;
    tagEl.hidden = !tag;
    li.querySelector(".todo-del").setAttribute("aria-label", `Delete “${t.text}”`);
    return li;
  }

  function render(todos, { tag } = {}) {
    tagFor = tag || (() => "");
    shown = todos;
    if (editingId && !todos.some((t) => t.id === editingId)) editingId = null;
    const current = [...ul.querySelectorAll(":scope > .todo")];
    // same items in the same order (e.g. she just ticked one): update in
    // place so the tick and strike-through can animate
    const same = current.length === todos.length && current.every((li, i) =>
      li.dataset.id === todos[i].id && li.classList.contains("editing") === (todos[i].id === editingId));
    if (same) {
      todos.forEach((t, i) => paint(current[i], t));
      return;
    }
    if (!todos.length) {
      ul.innerHTML = emptyText ? `<li class="np-empty">${emptyText}</li>` : "";
      return;
    }
    // keep keyboard focus on the same to-do across a rebuild
    const active = document.activeElement;
    const focusedId = ul.contains(active) ? active.closest(".todo")?.dataset.id : null;
    const focusSel = active?.matches?.(".txt") ? ".txt" : active?.matches?.(".todo-check input") ? ".todo-check input" : null;
    ul.replaceChildren(...todos.map((t) => paint(makeItem(t), t)));
    if (focusedId && focusSel) ul.querySelector(`[data-id="${focusedId}"] ${focusSel}`)?.focus();
  }

  const rerender = () => render(shown, { tag: tagFor });
  const focusItem = (id) => ul.querySelector(`[data-id="${id}"] .txt`)?.focus();

  function fillEditor(li, t) {
    li.classList.add("editing");
    li.innerHTML = `
      <form class="todo-edit">
        <input class="field" name="text" maxlength="120" required autocomplete="off" aria-label="To-do" />
        <div class="when-slot"></div>
        <div class="form-actions">
          <button type="button" class="btn btn-delete">Delete</button>
          <button type="button" class="btn te-cancel">Cancel</button>
          <button type="submit" class="btn btn-next">Save</button>
        </div>
      </form>`;
    const form = li.querySelector("form");
    form.elements.text.value = t.text;
    const when = createWhen(li.querySelector(".when-slot"));
    when.set(t.date);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = form.elements.text.value.trim();
      if (!text) return;
      editingId = null;
      store.updateTodo(t.id, { text, date: when.get() });
      focusItem(t.id); // gone if she moved it to another section; that's fine
    });
    li.querySelector(".te-cancel").addEventListener("click", () => cancelEdit());
    li.querySelector(".btn-delete").addEventListener("click", () => {
      editingId = null;
      store.deleteTodo(t.id);
      afterDelete?.();
    });
  }

  function startEdit(id) {
    editingId = id;
    rerender();
    ul.querySelector(`[data-id="${id}"] input[name=text]`)?.focus();
  }

  function cancelEdit() {
    if (!editingId) return false;
    const id = editingId;
    editingId = null;
    rerender();
    focusItem(id);
    return true;
  }

  ul.addEventListener("change", (e) => {
    if (e.target.matches(".todo-check input")) store.toggleTodo(e.target.closest(".todo").dataset.id);
  });
  ul.addEventListener("click", (e) => {
    const del = e.target.closest(".todo-del");
    if (del) {
      const li = del.closest(".todo");
      const nextId = (li.nextElementSibling || li.previousElementSibling)?.dataset?.id;
      store.deleteTodo(li.dataset.id);
      const next = nextId && ul.querySelector(`[data-id="${nextId}"] .txt`);
      if (next) next.focus();
      else afterDelete?.();
      return;
    }
    const txt = e.target.closest(".txt");
    if (txt) startEdit(txt.closest(".todo").dataset.id);
  });

  return { render, cancelEdit, isEditing: () => !!editingId };
}
