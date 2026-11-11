// Small per-device settings (not part of her planner data).
const CHIME = "vida-chime";

export function chimeOn() {
  try { return localStorage.getItem(CHIME) !== "off"; } catch { return true; }
}
export function setChime(on) {
  try { localStorage.setItem(CHIME, on ? "on" : "off"); } catch { /* private mode: fine */ }
}

// when she last saved a backup file (ISO string, or null)
const BACKUP = "vida-last-backup";
export function lastBackup() {
  try { return localStorage.getItem(BACKUP); } catch { return null; }
}
export function setLastBackup(iso) {
  try { localStorage.setItem(BACKUP, iso); } catch { /* fine */ }
}
