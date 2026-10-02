"""Chat with the assistant in the terminal: python -m assistant"""

import threading
import time

import anthropic

from .agent import Assistant
from .tools import pop_due_reminders

HELP = "Commands: /reset (new conversation), /exit (quit). Anything else goes to the assistant."


def _reminder_loop() -> None:
    while True:
        for r in pop_due_reminders():
            print(f"\n⏰ Reminder: {r['text']}\n> ", end="", flush=True)
        time.sleep(20)


def main() -> None:
    assistant = Assistant()
    threading.Thread(target=_reminder_loop, daemon=True).start()
    print("Personal Assistant ready. " + HELP)
    while True:
        try:
            text = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not text:
            continue
        if text in ("/exit", "/quit"):
            return
        if text == "/reset":
            assistant.reset()
            print("New conversation started.")
            continue
        if text == "/help":
            print(HELP)
            continue
        try:
            print(assistant.ask(text))
        except anthropic.AuthenticationError:
            print("API key is missing or invalid. Set ANTHROPIC_API_KEY.")
        except anthropic.RateLimitError:
            print("Rate limited. Please try again in a minute.")
        except anthropic.APIConnectionError:
            print("Could not reach the API. Check your internet connection.")
        except anthropic.APIStatusError as e:
            print(f"API error {e.status_code}: {e.message}")


if __name__ == "__main__":
    main()
