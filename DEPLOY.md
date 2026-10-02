# Railway par online karein aur APK banayein

Ye guide aapke assistant ko internet par daalti hai, taake phone par computer ke baghair chale, aur phir is ki **APK** banati hai.

Total waqt: lagbhag 15 minute.

---

## Hissa 1: Railway par server chalana

### 1. Project banayein
1. [railway.com](https://railway.com) par login karein.
2. **New Project** → **Deploy from GitHub repo** → `raxa27/test_app` chunein.
3. Pehli deploy shayad fail ho jaye kyunke settings abhi baqi hain. Is ki fikar na karein.

### 2. Sahi branch chunein
Service par click karein → **Settings** → **Source** → **Branch** mein `claude/modest-noether-aly5oe` chunein.
(Agar ye code `main` mein merge ho chuka hai to `main` hi rehne dein.)

### 3. Variables daalein
Service → **Variables** → **New Variable**. Ye chaar variables daalein:

| Naam | Value | Matlab |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Aapki Claude API key ([console.anthropic.com](https://console.anthropic.com) se) |
| `ASSISTANT_PASSWORD` | koi mazboot password | App kholne ka password. Is ke baghair server start nahi hoga. |
| `ASSISTANT_TIMEZONE` | `Asia/Karachi` | Reminders aapke time ke hisaab se bajein |
| `ASSISTANT_DATA_DIR` | `/data` | Notes, kharcha, contacts yahan save honge |

### 4. Data ke liye Volume lagayein
Volume ke baghair har nayi deploy par aapke notes, kharcha aur contacts mit jayenge.

1. Project canvas par service par **right-click** karein (ya `Ctrl/Cmd + K` dabayein) → **Add Volume** / **Attach Volume**.
2. **Mount path:** `/data`

### 5. Link banayein
Service → **Settings** → **Networking** → **Generate Domain**.
Aapko ek link milega, jaise:
```
https://test-app-production-xxxx.up.railway.app
```

### 6. Check karein
1. Wo link phone ke **Chrome** mein kholein.
2. Password daalein.
3. Orb dabayein aur bolein: "aaj kya tareekh hai?"

Jawab aa gaya to server tayar hai. ✅

> Agar kuch na chale to Railway mein service → **Deployments** → **View Logs** dekhein. Wahan error likha hota hai.

---

## Hissa 2: Install karna

### Aasan tareeqa (APK ki zaroorat nahi)
Chrome mein link kholein → menu (⋮) → **Install app** / **Add to Home screen**.
Ye bilkul app ki tarah icon se khulegi.

### APK file banana
1. [pwabuilder.com](https://www.pwabuilder.com) kholein.
2. Apna Railway link daalein → **Start**.
3. **Package for stores** → **Android** → **Generate Package**.
4. Ek `.zip` file download hogi. Is ke andar **`.apk`** file hai.
5. APK phone par bhejein (WhatsApp, USB ya Google Drive se) aur kholein.
6. Phone poochega "Install unknown apps?" → **Allow**, phir **Install**.

> ⚠️ Zip mein ek `signing-key-info.txt` aur `.keystore` file bhi hoti hai. Inhein sambhaal kar rakhein. App update karne ke liye inhi ki zaroorat padegi.

---

## Kharcha
- **Railway Hobby:** aapke plan mein shaamil credit mein ye chhota server aaram se chal jata hai.
- **Claude API:** har sawal ka thoda sa kharcha. [console.anthropic.com](https://console.anthropic.com) par limit set kar sakte hain.

## Code update karna
Jab bhi GitHub par nayi tabdeeli push hogi, Railway khud nayi deploy kar dega. App ya APK dobara install karne ki zaroorat nahi, kyunke app hamesha server se taaza version khud le leti hai.
