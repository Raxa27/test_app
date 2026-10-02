# FF Toolkit

Free Fire players ke liye ek hi app mein saare tools. Ye web app (PWA) ke roop mein browser mein chalta hai, aur Android app (APK) ke roop mein bhi.

## Tools

| Tab | Kya karta hai |
| --- | --- |
| Sensitivity | Screen size, RAM, playstyle aur fingers ke hisaab se General, Red Dot, 2x, 4x, AWM aur Free Look sensitivity suggest karta hai |
| Damage | Weapon, distance aur armor ke hisaab se headshot ya body damage, shots to kill aur TTK nikalta hai |
| Weapons | Do guns ki stats side by side compare karta hai. Weapon data app mein hi edit ho sakta hai |
| Characters | Role ke hisaab se character suggest karta hai |
| Stats | Match log karta hai (kills, damage, rank) aur Win %, K/D, avg kills aur graph dikhata hai. JSON export/import bhi hai |
| Tournament | Teams aur match results add karo, points table (placement + kills) apne aap banti hai |
| Diamonds | Diamond goals aur kitne aur chahiye, uska approx cost |
| Names | Stylish fonts aur symbols wale nicknames, ek tap mein copy |
| Codes | Redeem codes save karo, expiry aur used track karo (redeem sirf official site pe) |

Saara data phone ke browser storage (localStorage) mein rehta hai. Koi login nahi, koi server nahi.

> Weapon stats aur character abilities approximate hain aur game updates ke saath badalti hain. Ye app koi cheat ya hack nahi hai, aur game se connect nahi hota.

## Web app chalana

```bash
npm run serve        # http://localhost:3000
```

Ya `www/` folder ko kisi bhi static host pe daal do (GitHub Pages, Netlify). Phone pe site kholo, phir "Install" ya "Add to Home screen" dabao.

GitHub Pages: repo ke Settings → Pages → Source mein "GitHub Actions" select karo. Iske baad `main` pe push karte hi site deploy ho jayegi.

## Android app (APK)

**GitHub se (aasan):** har push pe GitHub Actions ka "Build web + Android" workflow chalta hai. Actions tab mein run kholo aur `ff-toolkit-apk` artifact download karo. Usme `app-debug.apk` hai, use phone pe install karo ("Install unknown apps" allow karna padega).

**Apne computer pe:** Node 22, JDK 21 aur Android Studio chahiye.

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android   # Android Studio mein Run ya Build APK
```

`www/` mein kuch bhi change karo to `npx cap sync android` dobara chalao.
