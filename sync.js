/*
 * Cloud sync: keeps your tasks the same on every device.
 *
 * How it works:
 *  - You sign in with your Google account.
 *  - Your whole to-do data is stored in Firebase (Google's free online database)
 *    in one document that only your account can read or write.
 *    (A document can hold about 1 MB, which is several years of tasks.)
 *  - Every change you make is uploaded, and every device listening to that document
 *    gets the update within a second or two.
 *  - If you're offline, changes are saved on the device and uploaded when you're back online.
 *
 * Until you fill in firebase-config.js, this file does nothing and the app just
 * saves on the device like before.
 */
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const SYNCED_USER_KEY = "dailyTodo.syncedUser"; // remembers which account this device last synced with

const bar = document.getElementById("syncBar");
const text = document.getElementById("syncText");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");

if (firebaseConfig) start().catch((err) => {
  console.error(err);
  bar.hidden = false;
  signInBtn.hidden = signOutBtn.hidden = true;
  text.textContent = "⚠️ Sync couldn't start. Check your internet connection.";
});

async function start() {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } =
    await import(`${SDK}/firebase-auth.js`);
  const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot, setDoc, serverTimestamp,
    terminate, clearIndexedDbPersistence } =
    await import(`${SDK}/firebase-firestore.js`);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // persistentLocalCache = keep a copy on the device so it works offline.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  bar.hidden = false;

  signInBtn.onclick = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      // Some phones block pop-ups; fall back to a full-page sign-in.
      if (err.code === "auth/popup-blocked") await signInWithRedirect(auth, provider);
      else if (err.code !== "auth/popup-closed-by-user") alert("Sign-in failed: " + err.message);
    }
  };

  signOutBtn.onclick = async () => {
    if (!confirm("Sign out of sync on this device?")) return;
    const wipe = confirm(
      "Also remove your tasks from this device?\n\n" +
      "Choose OK on a shared or public computer. Your tasks stay safe in the cloud.\n" +
      "Choose Cancel to keep a copy here."
    );
    await signOut(auth);
    if (wipe) {
      // Remove every local copy: the app's own storage and Firebase's offline cache.
      Object.keys(localStorage).filter((k) => k.startsWith("dailyTodo")).forEach((k) => localStorage.removeItem(k));
      try { await terminate(db); await clearIndexedDbPersistence(db); } catch (e) { console.warn(e); }
      location.reload();
    }
  };

  let stopListening = null;
  let lastJson = null; // the last version we sent or received, to avoid echo loops

  onAuthStateChanged(auth, (user) => {
    if (stopListening) { stopListening(); stopListening = null; }
    window.cloudSave = null;

    if (!user) {
      text.textContent = "☁️ Sign in to sync across your devices";
      signInBtn.hidden = false;
      signOutBtn.hidden = true;
      localStorage.removeItem(SYNCED_USER_KEY);
      return;
    }

    text.textContent = `☁️ Synced · ${user.email}`;
    signInBtn.hidden = true;
    signOutBtn.hidden = false;

    const ref = doc(db, "users", user.uid);
    const upload = (data) => {
      const json = JSON.stringify(data);
      if (json === lastJson) return; // nothing changed
      lastJson = json;
      setDoc(ref, { json, updatedAt: serverTimestamp() }).catch((err) => {
        console.error(err);
        text.textContent = "⚠️ Couldn't save to the cloud: " + err.message;
      });
    };

    stopListening = onSnapshot(ref, (snap) => {
      const local = window.DailyTodo.getData();
      const firstTimeHere = localStorage.getItem(SYNCED_USER_KEY) !== user.uid;
      localStorage.setItem(SYNCED_USER_KEY, user.uid);
      window.cloudSave = upload;

      if (!snap.exists()) { upload(local); return; } // first device ever: upload what's here

      const cloudJson = snap.data().json;
      if (cloudJson === lastJson) return; // this is our own change coming back
      lastJson = cloudJson;
      let cloud;
      try {
        cloud = window.DailyTodo.sanitize(JSON.parse(cloudJson)); // check cloud data before using it
      } catch (e) {
        console.error("Cloud data unreadable", e);
        text.textContent = "⚠️ Your cloud data couldn't be read. Nothing was changed.";
        return;
      }

      if (firstTimeHere) {
        // First sign-in on this device: combine, so tasks already added here aren't lost.
        const merged = merge(cloud, local);
        window.DailyTodo.replaceData(merged);
        upload(merged);
        window.DailyTodo.toast("☁️ Sync is on. Your devices now share one list.");
      } else {
        window.DailyTodo.replaceData(cloud); // another device made a change
      }
    }, (err) => {
      console.error(err);
      text.textContent = "⚠️ Sync error: " + err.message;
    });
  });
}

// Adds any tasks from `local` that the cloud copy doesn't have yet.
export function merge(cloud, local) {
  const out = JSON.parse(JSON.stringify(cloud));
  out.days ||= {};
  out.badges = { ...(local.badges || {}), ...(cloud.badges || {}) };
  for (const [key, day] of Object.entries(local.days || {})) {
    const target = (out.days[key] ||= { tasks: [] });
    const known = new Set(target.tasks.map((t) => t.id));
    for (const t of day.tasks) {
      if (known.has(t.id)) continue;
      target.tasks.push(t);
      if (!t.done) target.reviewed = false; // so it can still pop up as unfinished
    }
  }
  return out;
}
