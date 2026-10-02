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

## Phone par chalayein (Telegram)

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

Naya kaam sikhana ho to `tools.py` mein `@beta_tool` wala ek naya function likhein aur use `LOCAL_TOOLS` list mein daal dein.
