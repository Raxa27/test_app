# FF Toolkit

Fourteen tools for Free Fire players in one app. It runs in the browser as a web app (PWA) and on Android as an APK. Tools unlock for members the admin has given a login; everyone else sees a locked demo.

## Tools

| Tool | What it does |
| --- | --- |
| Sensitivity | Suggests General, Red Dot, 2x, 4x, AWM and Free Look sensitivity from your screen size, RAM, playstyle and finger setup |
| Graphics Settings | Recommends Graphics, High FPS, Shadow and resolution settings from your RAM, refresh rate and priority |
| Damage Calculator | Headshot and body damage, shots to kill and TTK for a weapon, distance and armor level |
| Weapon Compare | 40 guns (SMG, AR, Shotgun, Marksman, Sniper, LMG, Pistol) compared stat by stat. Weapon data is editable in the app |
| Character Combo | 31 characters and 8 pets with search and filters, plus a best combo (1 active + 3 passive + pet) for each role |
| Aim Trainer | 30-second tap drill; targets shrink as you score. Tracks hits, accuracy and your best score |
| Reaction Test | Five rounds of wait-for-green; shows your average, fastest and best reaction time |
| Match Stats | Log matches (kills, damage, rank) and see Booyah %, K/D, average kills and a chart. JSON export and import |
| Tournament | Add teams and match results; the points table (placement + kills) updates automatically |
| Team Maker | Shuffle players into solo, duo or squad teams and hand out roles (Rusher, Support, Sniper, IGL) |
| Drop Spot Picker | Random Bermuda landing spot; leave spots out or add your own |
| Practice Planner | Six daily drills with a practice streak |
| Diamond Planner | Diamond goals, how many more you need, and the approximate cost |
| Stylish Names | Nicknames in fancy fonts and symbols, copied with one tap |

Weapon stats, character abilities and graphics advice are approximate and change with game updates. The app is not a cheat or hack and never connects to the game.

## Members only: demo mode and admin login

Visitors who aren't logged in see the app as a demo: the home screen is visible, but every tool is blurred and locked behind a "Members only" card that tells them to contact the admin. There is no public sign-up; the admin creates each account.

The lock runs in the browser, so it keeps casual visitors out but won't stop someone who edits the page code. Members' saved data lives in Firestore behind the security rules.

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

**From GitHub (easiest):** every push runs the **Build web + Android** workflow. Open the run in the Actions tab and download the `ff-toolkit-apk` artifact. It contains `app-debug.apk`; install it on your phone (allow "Install unknown apps").

**On your own computer:** you need Node 22, JDK 21 and Android Studio.

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android   # then Run or Build APK in Android Studio
```

Run `npx cap sync android` again after changing anything in `www/`.
