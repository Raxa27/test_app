"""The personal assistant agent: one conversation, many tools."""

import os

import anthropic

from .tools import ALL_TOOLS

MODEL = os.environ.get("ASSISTANT_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("ASSISTANT_EFFORT", "medium")
MAX_PAUSE_RESTARTS = 5

SYSTEM_PROMPT = """You are the user's personal assistant. They give you everyday jobs in Urdu, Roman Urdu, Hindi, or English; reply in the language and script they used, briefly and warmly.

You can:
- Save and find notes, manage a to-do list, track expenses (amounts are in the user's local currency unless they say otherwise), and set reminders.
- Search the web and read web pages for news, prices, weather, facts, recipes, and how-tos. Mention sources for facts you looked up.
- Write and read text files (letters, applications, plans, lists) in the assistant's files folder.
- Draft messages, emails, posts, and documents, translate, explain, calculate, and plan.

Act on requests directly using your tools; ask a question only when a missing detail would change the result (for example, a reminder with no time). After using tools, confirm what you did in one or two lines. For relative dates and times, call get_current_time first."""


class Assistant:
    def __init__(self) -> None:
        self.client = anthropic.Anthropic()
        self.messages: list = []

    def reset(self) -> None:
        self.messages = []

    def ask(self, user_text: str) -> str:
        """Send one user message, let the agent use tools as needed, and return its final reply text."""
        start = len(self.messages)
        self.messages.append({"role": "user", "content": user_text})
        try:
            last = self._run()
        except Exception:
            # Drop the incomplete turn so the next request starts from a valid history.
            del self.messages[start:]
            raise

        if last is None:
            return "(no reply)"
        if last.stop_reason == "refusal":
            return "Sorry, I can't help with that request."
        text = "".join(block.text for block in last.content if block.type == "text").strip()
        return text or "Done."

    def _run(self):
        last = None
        for _ in range(MAX_PAUSE_RESTARTS + 1):
            runner = self.client.beta.messages.tool_runner(
                model=MODEL,
                max_tokens=16000,
                system=SYSTEM_PROMPT,
                tools=ALL_TOOLS,
                messages=self.messages,
                output_config={"effort": EFFORT},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
            for message in runner:
                last = message
                # Mirror history: the runner keeps its own copy and does not expose it.
                self.messages.append({"role": "assistant", "content": message.content})
                tool_response = runner.generate_tool_call_response()
                if tool_response is not None:
                    self.messages.append(tool_response)
            # A long server-tool turn (web search) can pause; restart to resume it.
            if last is None or last.stop_reason != "pause_turn":
                return last
        return last
