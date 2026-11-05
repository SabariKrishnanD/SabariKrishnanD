# 🔒 Security review

Last reviewed: November 5, 2026

## What was tested

| # | Attack | Before | After |
|---|---|---|---|
| 1 | Hacking code (XSS) typed as a task or while editing a task | ✅ Safe | ✅ Safe |
| 2 | Backup file with hacking code in every field (task text, IDs, dates, award names) | ✅ Safe | ✅ Safe |
| 3 | Backup that tries to tamper with JavaScript itself ("prototype pollution") | ✅ Safe | ✅ Safe |
| 4 | Backup with the wrong structure (lists where objects belong, empty values) | ❌ App broke for good | ✅ Fixed |
| 5 | Backup with a 2-million-character task | ❌ App froze | ✅ Fixed |
| 6 | A file that isn't a backup at all | ✅ Clear error | ✅ Clear error |
| 7 | Corrupted data saved in the browser | ❌ App broke | ✅ Fixed, and the broken copy is kept for recovery |
| 8 | Poisoned data arriving from the cloud | ❌ Could break every device | ✅ Fixed, with a warning shown |
| 9 | Other Google accounts using your Firebase project | ⚠️ Allowed (their own data only) | ✅ Locked to your account (see SYNC-SETUP.md, step 4) |
| 10 | Tasks left behind after signing out on a shared computer | ⚠️ Left on the device | ✅ Option to wipe the device on sign-out |

## Protections in place
- **No HTML from data.** Task text is always shown as plain text (`textContent`), never run as code.
- **Data checking.** `sanitize()` in `app.js` rebuilds all saved, backup and cloud data, keeping only expected fields and capping sizes (200 characters per task, 500 tasks per day, 5 MB per backup).
- **Content Security Policy.** A rule in `index.html` tells the browser to run code only from this site and Google's Firebase servers.
- **Firebase rules.** Only your Google account can read or write, only in the app's format, and under 1 MB.
- **Pinned Firebase version** (10.12.2), loaded from Google's own servers.
- **HTTPS** is always on with GitHub Pages.

## Things to know
- `firebase-config.js` is meant to be public. It only names your project; the rules do the protecting.
- Anyone with your **Google account** can see your tasks, so keep 2-step verification on.
- Backups are plain, unencrypted files. Don't leave them in shared folders.
- The Firebase rules haven't been checked against live Firebase yet. After setup, try opening the app in a private window signed in to a different Google account: it should show a "permissions" error and no tasks.
