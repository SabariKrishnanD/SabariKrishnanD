# ✅ Daily To-Do

A simple daily to-do list with rewards. Plan your day, check things off, earn points, level up and unlock awards.

## Features
- **Today's list**: add, edit (tap the text), complete and delete tasks
- **Fresh start every day**: unfinished tasks pop up the next morning, and you choose to add each one to today or discard it
- **Rewards**
  - ⭐ 10 points per task, 50 bonus points per award
  - 📈 Levels (Beginner → Legend)
  - 🔥 Day streak (days in a row with at least one task done)
  - 🏆 15 awards: First Step, Perfect Day, Week Warrior, Early Bird, Night Owl, Second Chance and more
- **Sync across devices** with Google sign-in (one-time setup: see [SYNC-SETUP.md](SYNC-SETUP.md))
- **History** of past days, plus backup download and restore
- Works on phone and desktop, with automatic dark mode

## Files
| File | What it does |
|---|---|
| `index.html` | The page structure (what's on screen) |
| `style.css` | How it looks (colors, layout, dark mode) |
| `app.js` | How it works (tasks, carry-over, points, awards) |
| `sync.js` | Keeps your devices in sync through Firebase |
| `firebase-config.js` | Your Firebase settings (paste them here to turn on sync) |

## Run it
- **On your computer:** double-click `index.html` to open it in your browser. Sync only works from the online link.
- **Online:** turn on GitHub Pages (Settings → Pages → Deploy from a branch).

## Saving & sync
- **Without sync:** tasks are saved in the browser you use. Use **History → Download backup / Restore backup** to move them.
- **With sync:** follow [SYNC-SETUP.md](SYNC-SETUP.md) once, then sign in with Google on each device to share one list.
