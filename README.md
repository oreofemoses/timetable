# Timetable

A cute flip-calendar planner: daily plans, a weekly schedule, to-dos, a diary with moods, and reminders.
It works offline and keeps everything on the device it's used on.

**Live:** https://oreofemoses.github.io/timetable/

## Put it on a phone

- **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the **⋮** menu, then **Add to Home screen** / **Install app**.

The gear in the top corner has the same steps, plus backups.

## Your data

Nothing is sent anywhere: plans, to-dos, diary and reminders live in the browser on that device.
Use **Settings (gear) → Save a backup** now and then, and **Restore a backup** to move to a new phone.

## Changing it

Plain HTML, CSS and JavaScript, no build step. To run it locally:

```
python -m http.server 5173
```

then open http://localhost:5173.

After changing any file, bump `VERSION` in `sw.js` (and add new files to its `SHELL` list) so installed copies pick up the change.

## Fonts

Fredoka and Gaegu, under the SIL Open Font License (see `fonts/OFL-*.txt`).
