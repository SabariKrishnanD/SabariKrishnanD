# ☁️ Turn on sync across devices

This takes about 10 minutes and is free. You do it once. After that, every device where you sign in with Google shows the same list.

You'll need: a Google account and your app's web address (`https://sabarikrishnand.github.io/SabariKrishnanD/`).

---

## 1. Create a Firebase project
1. Go to **https://console.firebase.google.com** and sign in with Google.
2. Click **Create a project** (or **Add project**).
3. Name it something like `daily-todo` and click **Continue**.
4. Google Analytics isn't needed, so turn it **off**. Then click **Create project** and wait, then **Continue**.

## 2. Register the web app and copy its settings
1. On the project home page, click the **`</>`** (Web) icon.
2. Give it a nickname like `daily-todo-web`. Leave "Firebase Hosting" **unticked**. Click **Register app**.
3. Firebase shows some code containing `const firebaseConfig = { ... };`. **Copy just the part from `{` to `}`.**
4. Click **Continue to console**.

## 3. Turn on Google sign-in
1. In the left menu: **Build → Authentication → Get started**.
2. Under **Sign-in method**, click **Google**, switch it **on**, pick your email as the support email, and click **Save**.
3. Go to the **Settings** tab, then **Authorized domains**, then **Add domain**, and enter:
   `sabarikrishnand.github.io`

## 4. Create the database and lock it down
1. In the left menu: **Build → Firestore Database → Create database**.
2. Pick a location close to you (for example `asia-south1` for India) and click **Next**.
3. Choose **Start in production mode** and click **Create**.
4. Open the **Rules** tab, replace everything with the rules below, and change `YOUR_EMAIL@gmail.com` to **your own Google email**. Then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Only YOUR Google account can use this database. Anyone else who signs in gets nothing.
    function isMe(userId) {
      return request.auth != null
        && request.auth.uid == userId
        && request.auth.token.email == "YOUR_EMAIL@gmail.com"
        && request.auth.token.email_verified == true;
    }

    match /users/{userId} {
      allow read: if isMe(userId);
      // Only accept data in the shape the app writes, and under 1 MB.
      allow write: if isMe(userId)
        && request.resource.data.keys().hasOnly(["json", "updatedAt"])
        && request.resource.data.json is string
        && request.resource.data.json.size() < 1000000;
    }

    // Everything else is locked.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> These rules live in Firebase, not in your public GitHub repo, so your email isn't published.

## 5. Paste your settings into the app
1. On GitHub, open your repo and click **`firebase-config.js`**, then the ✏️ (pencil) icon to edit.
2. Replace `null` in the last line with what you copied in step 2, so it looks like:
   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "daily-todo-xxxx.firebaseapp.com",
     projectId: "daily-todo-xxxx",
     storageBucket: "daily-todo-xxxx.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123",
   };
   ```
3. Click **Commit changes**. GitHub Pages updates in a minute or two.

> These settings are safe to put in a public repo. They only say *which* Firebase project to use. The rules from step 4 make sure only you can see your tasks.

## 6. Use it on every device
1. Open the app link on any device.
2. Tap **Sign in with Google** near the top and use the **same Google account** everywhere.
3. Tasks already on that device are combined with your cloud list the first time you sign in, so nothing is lost.

From then on, changes show up on your other devices within a second or two. If you're offline, changes are saved on the device and uploaded once you're back online.

---

## 7. Extra protection (recommended, 3 minutes)
1. **Lock your API key to your website.** Go to **https://console.cloud.google.com/apis/credentials**, pick your Firebase project at the top, and click the key named **"Browser key (auto created by Firebase)"**. Under **Application restrictions**, choose **Websites** and add:
   - `https://sabarikrishnand.github.io/*`
   - `https://YOUR-PROJECT-ID.firebaseapp.com/*` (your `authDomain` from step 2; sign-in needs it)

   Click **Save**. Other websites can no longer use your key.
2. **Stay on the free "Spark" plan.** It has no payment method, so you can never be charged. If Firebase ever offers an upgrade, you don't need it.
3. **On a shared or public computer**, use **Sign out** and choose **OK** when asked to remove your tasks from the device.

### Something not working?
- **"Sign-in failed… unauthorized-domain"**: redo step 3.3 and check the spelling of the domain.
- **"Missing or insufficient permissions"**: redo step 4.4 and make sure you clicked **Publish**.
- **"API key not valid" or "requests from this referrer are blocked"**: in step 7.1, check that both website lines are exactly right, then wait 5 minutes.
- **No sign-in button appears**: check that `firebase-config.js` was saved with your settings, then refresh the page.
- **Sign-in pop-up does nothing on your phone**: allow pop-ups for the site, or try again in Chrome or Safari, not inside another app's built-in browser.
