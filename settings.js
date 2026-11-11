// Settings (the little gear): put the app on the home screen, save and
// restore a backup file, and check the browser will keep her data.
// Also switches on offline support.
import { MONTHS } from "./shared.js";
import * as store from "./store.js";
import { lastBackup, setLastBackup } from "./prefs.js";
import { openDrawer, wireDrawer, fromKeyboard } from "./drawer.js";

const dlg = document.getElementById("settings");
const q = (s) => dlg.querySelector(s);

// ---------- offline support ----------
const secure = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
if ("serviceWorker" in navigator && secure) {
  navigator.serviceWorker.register("./sw.js").catch(() => { /* still works online */ });
}

// ---------- home screen ----------
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let installPrompt = null; // Chrome / Edge / Android hand us this when installing is possible
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  if (dlg.open) renderInstall();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  askToKeepData();
  if (dlg.open) render();
});

function renderInstall() {
  const done = standalone();
  q(".st-installed").hidden = !done;
  q(".st-install-btn").hidden = done || !installPrompt;
  q(".st-ios").hidden = done || !isIOS;
  q(".st-other").hidden = done || isIOS || !!installPrompt;
  q(".st-why").hidden = done;
}

q(".st-install-btn").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  renderInstall();
});

// ---------- keeping her data ----------
async function askToKeepData() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
// installed apps quietly ask the browser not to clear their data
if (standalone()) askToKeepData();

async function renderStorage() {
  const el = q(".st-persist");
  const btn = q(".st-persist-btn");
  let kept = false;
  try { kept = await navigator.storage?.persisted?.(); } catch { kept = false; }
  el.textContent = kept
    ? "This browser has promised to keep your things safe ✓"
    : "The browser could clear saved things if your phone runs very low on space. Adding it to your home screen and keeping a backup protects against that.";
  btn.hidden = kept || !navigator.storage?.persist;
}
q(".st-persist-btn").addEventListener("click", async () => {
  await askToKeepData();
  renderStorage();
});

// ---------- backup ----------
const statusEl = q(".st-status");
const restoreBox = q(".st-restore");
const fileInput = q(".st-file");
let pending = null; // a checked backup waiting for her "yes"

function niceDate(iso) {
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function countsText(c) {
  const bit = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [bit(c.plans, "plan", "plans"), bit(c.todos, "to-do", "to-dos"),
    bit(c.entries, "diary day", "diary days"), bit(c.reminders, "reminder", "reminders")].join(", ");
}

function renderBackup() {
  const last = lastBackup();
  q(".st-last").textContent = last ? `Last backup: ${niceDate(last)}` : "No backup saved yet";
  q(".st-export").disabled = !store.hasData();
}

q(".st-export").addEventListener("click", async () => {
  const name = `vida-timetable-backup-${store.dateKey(new Date())}.json`;
  const blob = new Blob([store.exportData()], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });
  const phone = window.matchMedia("(pointer: coarse)").matches;
  try {
    // on phones, the share sheet lets her keep it in Files, Drive, email…
    if (phone && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Vida's Timetable backup" });
    } else {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    setLastBackup(new Date().toISOString());
    statusEl.textContent = "Backup saved ✓";
  } catch (err) {
    if (err?.name !== "AbortError") statusEl.textContent = "Couldn't save the backup. Please try again.";
  }
  renderBackup();
});

q(".st-import").addEventListener("click", () => {
  fileInput.value = "";
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  let parsed = null;
  try { parsed = store.readBackup(JSON.parse(await file.text())); } catch { parsed = null; }
  fileInput.value = ""; // so picking the same file again still works
  if (!parsed) {
    pending = null;
    restoreBox.hidden = true;
    statusEl.textContent = "That doesn't look like a Vida's Timetable backup.";
    return;
  }
  pending = parsed;
  q(".st-restore-what").textContent =
    `This backup${parsed.exportedAt ? ` from ${niceDate(parsed.exportedAt)}` : ""} has ${countsText(store.counts(parsed.data))}.`;
  q(".st-restore-now").textContent = store.hasData()
    ? `Restoring replaces what's on this device now (${countsText(store.counts())}).`
    : "This device is empty, so nothing will be lost.";
  statusEl.textContent = "";
  restoreBox.hidden = false;
  q(".st-restore-yes").focus();
});

q(".st-restore-yes").addEventListener("click", () => {
  if (!pending) return;
  store.replaceAll(pending.data);
  pending = null;
  restoreBox.hidden = true;
  statusEl.textContent = "Restored ✓ Everything from the backup is back.";
  renderBackup();
});
q(".st-restore-no").addEventListener("click", () => {
  pending = null;
  restoreBox.hidden = true;
  statusEl.textContent = "";
  q(".st-import").focus();
});

// ---------- open ----------
function render() {
  renderInstall();
  renderStorage();
  renderBackup();
}

export function openSettings({ instant = false } = {}) {
  pending = null;
  restoreBox.hidden = true;
  statusEl.textContent = "";
  render();
  openDrawer(dlg, { instant });
}

document.querySelector(".settings-btn").addEventListener("click", (e) => openSettings({ instant: fromKeyboard(e) }));
wireDrawer(dlg);
