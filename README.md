# Personal Assistant Agent

Ek AI agent jo aapke kehne par rozana ke kaam karta hai. Urdu, Roman Urdu, Hindi ya English mein baat karein.

## Ye kya kar sakta hai

| Kaam | Misaal |
|---|---|
| 📝 Notes | "note kar lo: Ali ka number 0300-1234567" · "Ali ka number kya tha?" |
| ✅ To-do list | "kal tak bijli ka bill jama karna hai, zaroori hai" · "mere kaam dikhao" |
| 💰 Kharcha | "aaj 500 ka khana khaya" · "is mahine kitna kharcha hua?" |
| ⏰ Reminders | "2 ghante baad yaad dilana dawai leni hai" |
| 🌐 Internet | "aaj Lahore ka mausam?" · "dollar ka rate kya hai?" · "is link ka khulasa karo" |
| 🎵 YouTube | "Atif Aslam ka Tajdar-e-Haram lagao" · "cricket highlights dikhao" |
| 📞 Call / SMS | "Ammi ko call karo" · "Ali ko SMS karo ke main late hoon" |
| 🗺️ Maps / websites | "Badshahi Masjid ka rasta dikhao" · "Dawn news kholo" |
| 💬 WhatsApp | "Ammi ka number 0300-1234567 save karo" · "Ammi ko WhatsApp karo ke main raste mein hoon" |
| 📄 Files | "chhutti ki application likh kar save karo" · "meri files dikhao" |
| ✍️ Likhna | emails, posts, translation, hisaab, planning, sawal jawab |

Aapka saara data (notes, kharcha, reminders, files) aapke computer par `data/` folder mein rehta hai.

## Setup (ek dafa)

1. Python 3.10+ install karein.
2. Claude API key lein: https://console.anthropic.com → API Keys.
3. Install karein:
   ```bash
   pip install -r requirements.txt
   ```
4. Key set karein:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."      # Windows: set ANTHROPIC_API_KEY=sk-ant-...
   ```

## Computer par chalayein

```bash
python -m assistant
```

```
> aaj 300 ka rickshaw aur 450 ka lunch
Dono kharche save ho gaye: transport 300, food 450.
> kal subah 9 baje yaad dilana meeting hai
Reminder set: 2026-10-03 09:00 — meeting.
```

Commands: `/reset` se nai baat shuru hoti hai aur `/exit` se band hota hai.

## 🎙️ Siri ki tarah bol kar chalayein

```bash
python -m assistant.voice_server
```

Phir **Chrome ya Edge** mein `http://localhost:8000` kholein.

- **Orb dabayein aur bolein:** "kal subah 9 baje meeting ka reminder laga do". Agent kaam kar ke bol kar jawab dega.
- **Hey mode:** ise on karein to orb dabane ki zaroorat nahi. Bas **"suno"** bolein aur phir apna kaam batayein, jaise "suno, aaj ka mausam kaisa hai?". Ye "hey assistant" aur "hey dost" bhi samajhta hai.
- Upar se zabaan chunein: اردو, हिन्दी ya English.
- Reminder ka waqt aane par ye bol kar yaad dilata hai, jab tak page khula ho.
- Jawab bolte waqt orb dabayein to wo chup ho jayega.

### Sensitive kaam: sirf 1 dafa confirmation

| Kaam | Confirmation |
|---|---|
| YouTube, Maps, website kholna | Nahi, seedha khul jata hai |
| Call, WhatsApp, SMS | Haan, **sirf ek dafa** |

Misaal: "Ammi ko call karo"
1. Agent poochta hai: **"Call karun?"** aur screen par **Haan / Nahi** card aata hai.
2. Aap bol dein **"haan"** ya **"nahi"**, ya button daba dein.
3. "Haan" par phone ka dialer number ke saath khul jata hai. WhatsApp aur SMS mein message pehle se likha hota hai.

Agent khud alag se ijazat nahi maangta, is liye har kaam par confirmation sirf ek hi dafa hoti hai.

> Phone ka system security ke liye aakhri tap aap se karwata hai: call ka hara button aur WhatsApp mein Send. Koi bhi browser app is ke baghair call ya message nahi kar sakti.

### App ki tarah install karein

Chrome mein page kholne ke baad address bar mein **Install** ka icon aata hai. Phone par Chrome menu (⋮) mein **"Add to Home screen" / "Install app"** hota hai. Install karne ke baad ye apne icon ke saath alag app ki tarah khulta hai.

Yaad rahe: app ka "dimagh" aapke computer par chalne wala server hai. Server band ho to app jawab nahi dega.

### Phone par voice assistant

Phone ka browser mic sirf **https** link par chalne deta hai. Is ka sabse aasan tareeqa ek free tunnel hai:

1. Password zaroor set karein, warna link wala koi bhi shakhs aapka assistant chala sakta hai:
   ```bash
   export ASSISTANT_PASSWORD="koi-mazboot-password"
   python -m assistant.voice_server
   ```
2. Doosri terminal mein [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) chalayein:
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
3. Jo `https://....trycloudflare.com` link mile wo phone par Chrome mein kholein aur password daalein.
4. Chrome menu se **"Add to Home screen"** dabayein. Ab ye phone par app ki tarah icon se khulega.

iPhone par Safari mein bhi chalta hai, lekin Hey mode Chrome (Android) aur computer par behtar kaam karta hai.

## Phone par likh kar chalayein (Telegram)

1. Telegram mein **@BotFather** kholein, `/newbot` likhein aur jo token mile wo copy karein.
2. Bot chalayein:
   ```bash
   export TELEGRAM_BOT_TOKEN="123456:ABC..."
   python -m assistant.telegram_bot
   ```
3. Apne bot ko Telegram par koi bhi message bhejein. Wo jawab mein aapka **chat id** bataye ga.
4. Bot band karein, chat id set karein aur dobara chalayein. Is ke baad sirf aap hi bot use kar sakenge:
   ```bash
   export TELEGRAM_ALLOWED_CHAT_ID="123456789"
   python -m assistant.telegram_bot
   ```

Reminders bhi Telegram par aayenge, lekin sirf tab jab bot chal raha ho. Bot ko 24/7 chalane ke liye kisi server ya VPS par chalayein.

## Settings (optional)

| Variable | Default | Matlab |
|---|---|---|
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Kaunsa Claude model istemal ho |
| `ASSISTANT_EFFORT` | `medium` | `low` = tez aur sasta, `high` = zyada soch kar jawab |
| `ASSISTANT_DATA_DIR` | `./data` | Data kahan save ho |

## Code

- `assistant/agent.py`: agent ka dimagh (Claude + tools ka loop)
- `assistant/tools.py`: saare tools (notes, tasks, kharcha, reminders, files, web search)
- `assistant/cli.py`: terminal chat
- `assistant/telegram_bot.py`: Telegram bot
- `assistant/voice_server.py` + `assistant/static/voice.html`: Siri jaisa voice assistant

Naya kaam sikhana ho to `tools.py` mein `@beta_tool` wala ek naya function likhein aur use `LOCAL_TOOLS` list mein daal dein.
