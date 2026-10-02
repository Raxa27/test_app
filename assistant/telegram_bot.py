"""Use the assistant from your phone via Telegram: python -m assistant.telegram_bot

Environment variables:
  ANTHROPIC_API_KEY         your Claude API key
  TELEGRAM_BOT_TOKEN        token from @BotFather
  TELEGRAM_ALLOWED_CHAT_ID  your own chat id; only this chat can use the bot
"""

import logging
import os
import sys

import anthropic
import httpx2 as httpx

from .agent import Assistant
from .tools import pop_due_reminders

log = logging.getLogger("telegram_bot")
POLL_TIMEOUT = 25  # seconds; also bounds how late a reminder can be


class TelegramBot:
    def __init__(self, token: str, allowed_chat_id: str | None) -> None:
        self.api = f"https://api.telegram.org/bot{token}"
        self.allowed_chat_id = allowed_chat_id
        self.http = httpx.Client(timeout=POLL_TIMEOUT + 10)
        self.assistant = Assistant()

    def send(self, chat_id: int | str, text: str) -> None:
        # Telegram caps messages at 4096 characters.
        for i in range(0, len(text), 4000):
            self.http.post(f"{self.api}/sendMessage", json={"chat_id": chat_id, "text": text[i:i + 4000]})

    def handle(self, chat_id: int, text: str) -> None:
        if self.allowed_chat_id is None:
            self.send(chat_id, f"Your chat id is {chat_id}. Set TELEGRAM_ALLOWED_CHAT_ID={chat_id} and restart the bot.")
            return
        if str(chat_id) != self.allowed_chat_id:
            return
        if text == "/start":
            self.send(chat_id, "Assalam o Alaikum! Main Zuzu hoon. Bataiye kya kaam karna hai. /reset se nai baat shuru karein.")
            return
        if text == "/reset":
            self.assistant.reset()
            self.send(chat_id, "New conversation started.")
            return
        self.http.post(f"{self.api}/sendChatAction", json={"chat_id": chat_id, "action": "typing"})
        try:
            reply = self.assistant.ask(text)
            for action in self.assistant.last_actions:
                if action["type"] in ("call", "sms"):
                    # Telegram does not open tel:/sms: links, but it makes phone numbers tappable.
                    reply += f"\n\n👉 {action['label']}: tap the number to confirm\n{action['url'].split(':', 1)[1].split('?')[0]}"
                else:
                    hint = "tap to confirm" if action["confirm"] else "tap to open"
                    reply += f"\n\n👉 {action['label']} ({hint}):\n{action['url']}"
        except anthropic.RateLimitError:
            reply = "Rate limited. Please try again in a minute."
        except anthropic.APIConnectionError:
            reply = "Could not reach the API. Please try again."
        except anthropic.APIStatusError as e:
            reply = f"API error {e.status_code}: {e.message}"
        self.send(chat_id, reply)

    def send_due_reminders(self) -> None:
        if self.allowed_chat_id is None:
            return
        for r in pop_due_reminders():
            self.send(self.allowed_chat_id, f"⏰ Reminder: {r['text']}")

    def run(self) -> None:
        offset = None
        log.info("Bot running. Press Ctrl+C to stop.")
        while True:
            self.send_due_reminders()
            try:
                resp = self.http.get(f"{self.api}/getUpdates", params={"timeout": POLL_TIMEOUT, "offset": offset})
                resp.raise_for_status()
                updates = resp.json().get("result", [])
            except httpx.HTTPError as e:
                log.warning("Polling failed: %s", e)
                continue
            for update in updates:
                offset = update["update_id"] + 1
                message = update.get("message") or {}
                text = (message.get("text") or "").strip()
                if text:
                    self.handle(message["chat"]["id"], text)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        sys.exit("Set TELEGRAM_BOT_TOKEN (get one from @BotFather on Telegram).")
    TelegramBot(token, os.environ.get("TELEGRAM_ALLOWED_CHAT_ID")).run()


if __name__ == "__main__":
    main()
