"""The personal assistant agent: one conversation, many tools."""

import os

import anthropic

from .tools import ALL_TOOLS, PENDING_ACTIONS

# Short names people are likely to type in ASSISTANT_MODEL.
MODEL_ALIASES = {"opus": "claude-opus-5-5", "sonnet": "claude-sonnet-5-5"}
_model = os.environ.get("ASSISTANT_MODEL", "").strip()
MODEL = MODEL_ALIASES.get(_model.lower(), _model) or "claude-opus-5-5"
EFFORT = os.environ.get("ASSISTANT_EFFORT", "medium")
MAX_PAUSE_RESTARTS = 5

SYSTEM_PROMPT = """You are Zuzu, the user's personal assistant. They give you everyday jobs in Urdu, Roman Urdu, Hindi, or English; reply in the language and script they used, briefly and warmly.

You can:
- Save and find notes, manage a to-do list, track expenses (amounts are in the user's local currency unless they say otherwise), and set reminders.
- Search the web and read web pages for news, prices, weather, facts, recipes, and how-tos. Mention sources for facts you looked up.
- Control the user's device: play songs or videos on YouTube, open websites and Google Maps directions, make phone calls, and send WhatsApp messages or SMS. Use save_contact when the user gives a number for someone.
- Calls, WhatsApp, and SMS are sensitive: the app itself asks the user to confirm once. Do not ask for permission before calling those tools; call the tool, then end your reply with one short confirmation question. Opening YouTube, maps, or websites needs no confirmation.
- Write and read text files (letters, applications, plans, lists) in the assistant's files folder.
- Draft messages, emails, posts, and documents, translate, explain, calculate, and plan.

Act on requests directly using your tools; ask a question only when a missing detail would change the result (for example, a reminder with no time). After using tools, confirm what you did in one or two lines. For relative dates and times, call get_current_time first."""

VOICE_PROMPT = """

This conversation is spoken aloud: the user talks to you through a microphone and your reply is read out by text-to-speech. Keep replies to one to three short sentences, in plain conversational language. Do not use markdown, bullet points, emojis, URLs, or tables. Write numbers and times the way a person would say them. If the user spoke Urdu, reply in Urdu script; if Hindi, in Devanagari; if English, in English."""


class AssistantError(Exception):
    """A user-facing error from the AI service."""


def create_assistant(voice: bool = False):
    """Pick the AI backend: Claude by default, Gemini when only a Gemini key is configured or ASSISTANT_PROVIDER=gemini."""
    provider = os.environ.get("ASSISTANT_PROVIDER", "").strip().lower()
    has_gemini_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    if provider == "gemini" or (not provider and has_gemini_key and not os.environ.get("ANTHROPIC_API_KEY")):
        from .gemini_agent import GeminiAssistant

        return GeminiAssistant(SYSTEM_PROMPT + (VOICE_PROMPT if voice else ""))
    return Assistant(voice=voice)


class Assistant:
    def __init__(self, voice: bool = False) -> None:
        self.client = anthropic.Anthropic()
        self.system = SYSTEM_PROMPT + (VOICE_PROMPT if voice else "")
        self.messages: list = []
        self.last_actions: list[dict] = []

    def reset(self) -> None:
        self.messages = []

    def ask(self, user_text: str) -> str:
        """Send one user message, let the agent use tools as needed, and return its final reply text."""
        PENDING_ACTIONS.clear()
        self.last_actions = []
        start = len(self.messages)
        self.messages.append({"role": "user", "content": user_text})
        try:
            last = self._run()
        except Exception:
            # Drop the incomplete turn so the next request starts from a valid history.
            del self.messages[start:]
            raise
        finally:
            self.last_actions = list(PENDING_ACTIONS)
            PENDING_ACTIONS.clear()

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
                system=self.system,
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
