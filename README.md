# FF Toolkit

Nineteen tools for Free Fire players in one app. It runs in the browser as a web app (PWA) and on Android as an APK. Tools unlock for members the admin has given a login; everyone else sees a locked demo.

## Tools

Tools are grouped on the home screen into four sections.

| Section | Tool | What it does |
| --- | --- | --- |
| Setup | Sensitivity | Suggests General, Red Dot, 2x, 4x, AWM and Free Look sensitivity from your screen size, RAM, playstyle and finger setup |
| Setup | Graphics Settings | Recommends Graphics, High FPS, Shadow and resolution settings from your RAM, refresh rate and priority |
| Setup | Damage Calculator | Headshot and body damage, shots to kill and TTK for a weapon, distance and armor level |
| Setup | Weapon Compare | 40 guns (SMG, AR, Shotgun, Marksman, Sniper, LMG, Pistol) compared stat by stat. Weapon data is editable in the app |
| Setup | Character Combo | 31 characters and 8 pets with search and filters, plus a best combo (1 active + 3 passive + pet) for each role |
| Training | Practice Planner | 12 daily drills (6 in the game, 6 in this app). App drills tick themselves when you finish a round; any 8 keep your streak going |
| Training | Aim Trainer | 30-second tap drill; targets shrink as you score. Tracks hits, accuracy and your best score |
| Training | Drag Headshot | Press on an enemy's body, drag up and release on the head, like the in-game drag shot. 20 enemies, and they strafe from the 6th |
| Training | Tracking | Keep your finger on a target that speeds up over 20 seconds; scores your time on target |
| Training | Peek Reflex | Enemies peek out from either side of a wall for shorter and shorter windows; hit them before they hide |
| Training | Reaction Test | Five rounds of wait-for-green; shows your average, fastest and best reaction time |
| Training | Tap Speed | Taps per second over 10 seconds |
| Training | Spot the Enemy | Find the one tile with a slightly different shade; the grid grows and the difference shrinks each level |
| Squad & stats | Match Stats | Log matches (kills, damage, rank) and see Booyah %, K/D, average kills and a chart. JSON export and import |
| Squad & stats | Tournament | Add teams and match results; the points table (placement + kills) updates automatically |
| Squad & stats | Team Maker | Shuffle players into solo, duo or squad teams and hand out roles (Rusher, Support, Sniper, IGL) |
| Squad & stats | Drop Spot Picker | Random Bermuda landing spot; leave spots out or add your own |
| Extras | Diamond Planner | Diamond goals, how many more you need, and the approximate cost |
| Extras | Stylish Names | Nicknames in fancy fonts and symbols, copied with one tap |

Every training game saves your best score, and members' best scores sync with their account.

Weapon stats, character abilities and graphics advice are approximate and change with game updates. The app is not a cheat or hack and never connects to the game.

## Members only: demo mode and admin login

Visitors who aren't logged in see the app as a demo: the home screen is visible, but every tool is blurred and locked behind a "Members only" card that tells them to contact the admin. There is no public sign-up; the admin creates each account.

The lock runs in the browser, so it keeps casual visitors out but won't stop someone who edits the page code. Members' saved data lives in Firestore behind the security rules.

### Built-in admin account

Without any setup, the app has one built-in account: username `admin`, password `admin123`. It unlocks every tool, but its data stays on that device (no cloud sync). Change this password before you share the app: put the SHA-256 hash of a new, long password in `FF_LOCAL_ACCOUNTS` in [`www/firebase-config.js`](www/firebase-config.js) (`echo -n 'new password' | sha256sum`). You can add more built-in accounts there the same way. The page code is public, so anyone who reads it can try to guess these passwords; use Firebase accounts for members.

### Add users from the Admin panel

Log in with a built-in admin account and open **Account → Admin panel** (also in the sidebar on wider screens). Enter a name, username and password (or tap **Generate**) and pick an access period: 7, 30 or 90 days, or no expiry. The app makes an access code and a ready-to-send message; copy it or tap **Share on WhatsApp**.

The member opens the app, taps **Log in**, enters the username and password, opens **First time here?** and pastes the access code. After that, the username and password work on that phone until the access period ends; then the tools lock again and the member is asked to contact you.

How it works and its limits:

- The code holds the username, name, password hash and expiry, signed with `FF_SIGNING_KEY` in [`www/firebase-config.js`](www/firebase-config.js). A changed or made-up code is rejected.
- Nothing is stored on a server, so a code can't be cancelled once it's sent. Use short access periods if you may need to cut someone off. Changing `FF_SIGNING_KEY` stops all codes that haven't been used yet.
- The signing key ships inside the app, so someone who reads the code could make their own access codes. That's the same limit as the browser-side lock itself.
- The Admin panel keeps a list of the logins you created on your own device. Passwords aren't saved anywhere.

### Turn on login (free Spark plan is enough)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password**.
3. **Authentication → Settings → User actions**: untick **Enable create (sign-up)** so only you can create accounts.
4. **Build → Firestore Database → Create database** (production mode). Open the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and publish.
5. **Project settings → Your apps → Web (`</>`)**: register an app and copy the `firebaseConfig` object.
6. In [`www/firebase-config.js`](www/firebase-config.js), set `window.FF_FIREBASE_CONFIG = { ... }` to that object, and fill in `window.FF_ADMIN_CONTACT` with how players reach you (for example WhatsApp). Commit and push.
7. **Authentication → Settings → Authorized domains**: add the domain the website runs on (for example `raxa27.github.io`). `localhost` is already listed, which covers the Android app.

### Give someone access

**Authentication → Users → Add user**: enter their email and a password, then send them those details. To remove access, disable or delete the user there.

When a member logs in, their stats, tournament, goals, practice streak and best scores sync to their account and appear on every device. Logging out clears that data from the device; it stays in the cloud.

The Firebase web config is not a secret; the Firestore rules are what keep each member's data private.

## Run the web app

```bash
npm run serve        # http://localhost:3000
```

Or put the `www/` folder on any static host (GitHub Pages, Netlify). Open the site on your phone and tap **Install** or **Add to Home screen**.

GitHub Pages: in the repo go to **Settings → Pages → Source** and choose **GitHub Actions**. Every push to `main` then deploys the site.

## Android app (APK)

**Direct download (easiest):** every push builds the app and publishes it to the **FF Toolkit (latest build)** release: <https://github.com/Raxa27/test_app/releases/latest/download/FF-Toolkit.apk>. Open that link on your phone and install it (allow "Install unknown apps"). The same file is also attached to each run in the Actions tab as `ff-toolkit-apk`.

**On your own computer:** you need Node 22, JDK 21 and Android Studio.

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android   # then Run or Build APK in Android Studio
```

Run `npx cap sync android` again after changing anything in `www/`.
