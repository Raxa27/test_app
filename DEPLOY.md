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

> 💸 **Paise nahi kharch karne?** Claude ki jagah **Gemini (free)** istemal karein. Neeche "Free tareeqa: Gemini" dekhein. Us surat mein `ANTHROPIC_API_KEY` ki jagah `GEMINI_API_KEY` daalein.

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

## Bilkul free: Render + Gemini (koi paisa nahi)

Railway ka Hobby plan paid hai. Agar koi bhi paisa nahi lagana to **Render.com** ka free plan aur **Gemini** ki free key istemal karein.

1. Pehle Gemini ki free key le lein (neeche "Free tareeqa: Gemini" ka step 1-2).
2. Phone par **render.com** kholein → **Get Started** → **GitHub se sign up** karein.
3. **New +** → **Blueprint** → `Raxa27/test_app` repo chunein. Agar repo list mein na ho to **Configure GitHub** se Render ko is repo ki access dein.
4. Render khud `render.yaml` file parh lega aur do cheezein poochega:
   - `GEMINI_API_KEY` = aapki `AIza...` key
   - `ASSISTANT_PASSWORD` = apna password
5. **Apply / Deploy** dabayein. 3-5 minute mein build ho jayega.
6. Upar `https://zuzu-xxxx.onrender.com` jaisa link nazar aayega. Use Chrome mein kholein → password → menu (⋮) → **Install app**.

Free plan ki kamiyan:
- **So jata hai:** 15 minute koi istemal na kare to server so jata hai. Agla pehla sawal 30-60 second late jawab deta hai, phir tez chalta hai.
- **Data save nahi rehta:** free plan mein disk nahi hoti. Server restart ya nayi deploy par notes, kharcha, contacts aur reminders mit jate hain. Zaroori cheezein kahin aur bhi likh kar rakhein.
- **Reminders:** server so raha ho to reminder time par nahi bajta.

## Free tareeqa: Gemini

Claude API ke liye credits khareedne padte hain. Agar paise nahi lagane to Zuzu **Google Gemini** par bhi chalta hai, jis ka free plan hai aur card nahi chahiye.

1. Phone par **aistudio.google.com** kholein aur Google account se login karein.
2. **Get API key** → **Create API key** dabayein aur key copy karein (`AIza...` se shuru hoti hai).
3. Railway → **Variables** mein:

   | Naam | Value |
   |---|---|
   | `GEMINI_API_KEY` | `AIza...` wali key |

   `ANTHROPIC_API_KEY` wala variable **delete** kar dein. Dono hon to Zuzu Claude istemal karta hai. Ya phir `ASSISTANT_PROVIDER` = `gemini` daal dein.
4. **Deploy** dabayein.

Free plan ki baatein:
- Har minute aur har din sawalon ki ek hadd hoti hai. Hadd poori ho to Zuzu kehta hai "Free limit poori ho gayi", phir thodi der baad dobara chal jata hai.
- Free plan mein Google aapke sawal apne AI ko behtar banane ke liye istemal kar sakta hai, is liye bohat zaati maloomat na batayein.
- Agar kabhi "model not found" error aaye to `GEMINI_MODEL` variable mein AI Studio par likha naya model naam daalein (default `gemini-flash-latest`).

## Kharcha
- **Railway Hobby:** aapke plan mein shaamil credit mein ye chhota server aaram se chal jata hai.
- **Claude API:** har sawal ka thoda sa kharcha. [console.anthropic.com](https://console.anthropic.com) par limit set kar sakte hain.

## Code update karna
Jab bhi GitHub par nayi tabdeeli push hogi, Railway khud nayi deploy kar dega. App ya APK dobara install karne ki zaroorat nahi, kyunke app hamesha server se taaza version khud le leti hai.
