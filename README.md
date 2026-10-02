# FF Toolkit

Nine tools for Free Fire players in one app. It runs in the browser as a web app (PWA) and on Android as an APK, with optional login and cloud sync.

## Tools

| Tool | What it does |
| --- | --- |
| Sensitivity | Suggests General, Red Dot, 2x, 4x, AWM and Free Look sensitivity from your screen size, RAM, playstyle and finger setup |
| Damage Calculator | Headshot and body damage, shots to kill and TTK for a weapon, distance and armor level |
| Weapon Compare | 40 guns (SMG, AR, Shotgun, Marksman, Sniper, LMG, Pistol) compared stat by stat. Weapon data is editable in the app |
| Character Combo | 31 characters and 8 pets with search and filters, plus a best combo (1 active + 3 passive + pet) for each role |
| Match Stats | Log matches (kills, damage, rank) and see Booyah %, K/D, average kills and a chart. JSON export and import |
| Tournament | Add teams and match results; the points table (placement + kills) updates automatically |
| Diamond Planner | Diamond goals, how many more you need, and the approximate cost |
| Stylish Names | Nicknames in fancy fonts and symbols, copied with one tap |
| Redeem Codes | Save codes and track expiry and used status (redeem only on the official site) |

Weapon stats and character abilities are approximate and change with game updates. The app is not a cheat or hack and never connects to the game.

## Login and cloud sync

Players can sign up with email and password or Google, or keep using the app as a guest. When logged in, stats, tournaments, diamond goals, redeem codes and weapon edits are saved to Firestore and appear on every device. Guests keep everything on the device only.

Login stays off until you add a Firebase config. To turn it on (free Spark plan is enough):

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** and **Google**.
3. **Build → Firestore Database → Create database** (production mode). Open the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and publish.
4. **Project settings → Your apps → Web (`</>`)**: register an app and copy the `firebaseConfig` object.
5. Paste it into [`www/firebase-config.js`](www/firebase-config.js) as `window.FF_FIREBASE_CONFIG = { ... }`, then commit and push.
6. **Authentication → Settings → Authorized domains**: add the domain the website runs on (for example `raxa27.github.io`). `localhost` is already listed, which covers the Android app.

The Firebase web config is not a secret; the Firestore rules are what keep each user's data private.

In the Android app, Google blocks its sign-in page inside app webviews, so the APK shows email and password login only.

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
