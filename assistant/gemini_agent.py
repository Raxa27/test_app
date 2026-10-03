"""The same assistant, powered by Google Gemini (free tier available at aistudio.google.com)."""

import os
import re
import time
from html import unescape

import httpx2
from google import genai
from google.genai import errors, types

from .agent import AssistantError
from .tools import LOCAL_TOOLS, PENDING_ACTIONS

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
# Tried in order when the main model is overloaded (503) or out of free quota (429).
FALLBACK_MODELS = [
    m.strip()
    for m in os.environ.get("GEMINI_FALLBACK_MODELS", "gemini-flash-lite-latest,gemini-2.5-flash").split(",")
    if m.strip() and m.strip() != GEMINI_MODEL
]
MAX_TOOL_ROUNDS = 12
RETRY_DELAYS = (1.5, 4)  # seconds between attempts on the same model when the service is busy


def _generate(client: genai.Client, contents, config: types.GenerateContentConfig):
    """generate_content with retries on busy servers and fallback to other models."""
    last_error = None
    for model in [GEMINI_MODEL, *FALLBACK_MODELS]:
        for delay in (*RETRY_DELAYS, None):
            try:
                return client.models.generate_content(model=model, contents=contents, config=config)
            except errors.APIError as e:
                last_error = e
                if e.code == 429 or e.code == 404:
                    break  # quota is per model, and a missing model won't appear: try the next one
                if e.code not in (500, 502, 503, 504) or delay is None:
                    break
                time.sleep(delay)
        if last_error is not None and last_error.code not in (429, 404, 500, 502, 503, 504):
            raise last_error
    raise last_error


def _web_search(client: genai.Client, query: str) -> str:
    """Answer a query with Google Search grounding (a separate request, since it can't mix with function tools)."""
    resp = _generate(
        client,
        contents=f"Search the web and answer concisely with key facts and source names: {query}",
        config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
    )
    return resp.text or "No results."


def _web_fetch(url: str) -> str:
    if not url.startswith(("https://", "http://")):
        return "Only http(s) links can be fetched."
    try:
        r = httpx2.get(url, follow_redirects=True, timeout=20, headers={"User-Agent": "Mozilla/5.0 (Zuzu assistant)"})
        r.raise_for_status()
    except httpx2.HTTPError as e:
        return f"Could not fetch the page: {e}"
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", r.text)
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()[:20_000]


EXTRA_DECLARATIONS = [
    types.FunctionDeclaration(
        name="web_search",
        description="Search the internet for current information: news, weather, prices, facts, how-tos.",
        parameters_json_schema={
            "type": "object",
            "properties": {"query": {"type": "string", "description": "What to search for."}},
            "required": ["query"],
        },
    ),
    types.FunctionDeclaration(
        name="web_fetch",
        description="Read the text of a web page the user gave or that a search found.",
        parameters_json_schema={
            "type": "object",
            "properties": {"url": {"type": "string", "description": "Full http(s) URL."}},
            "required": ["url"],
        },
    ),
]


class GeminiAssistant:
    def __init__(self, system: str) -> None:
        self.client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
        self.tools = {t.name: t for t in LOCAL_TOOLS}
        declarations = [
            types.FunctionDeclaration(name=t.name, description=t.description, parameters_json_schema=t.input_schema)
            for t in LOCAL_TOOLS
        ] + EXTRA_DECLARATIONS
        self.config = types.GenerateContentConfig(
            system_instruction=system,
            tools=[types.Tool(function_declarations=declarations)],
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        self.history: list[types.Content] = []
        self.last_actions: list[dict] = []

    def reset(self) -> None:
        self.history = []

    def _run_tool(self, name: str, args: dict) -> str:
        try:
            if name == "web_search":
                return _web_search(self.client, args.get("query", ""))
            if name == "web_fetch":
                return _web_fetch(args.get("url", ""))
            tool = self.tools.get(name)
            if tool is None:
                return f"Unknown tool {name}."
            return str(tool.call(args))
        except Exception as e:  # report tool failures to the model instead of crashing the turn
            return f"Tool error: {e}"

    def ask(self, user_text: str) -> str:
        PENDING_ACTIONS.clear()
        self.last_actions = []
        start = len(self.history)
        self.history.append(types.Content(role="user", parts=[types.Part(text=user_text)]))
        try:
            reply = self._loop()
        except errors.APIError as e:
            del self.history[start:]
            if e.code in (401, 403) or "API key" in str(e):
                raise AssistantError("Gemini API key ghalat hai ya missing hai (GEMINI_API_KEY).") from e
            if e.code == 429:
                raise AssistantError("Free limit poori ho gayi. Thodi der baad koshish karein.") from e
            if e.code in (500, 502, 503, 504):
                raise AssistantError("Gemini abhi bohat busy hai. 1-2 minute baad dobara poochein.") from e
            raise AssistantError(f"AI service error {e.code}.") from e
        except Exception:
            del self.history[start:]
            raise
        finally:
            self.last_actions = list(PENDING_ACTIONS)
            PENDING_ACTIONS.clear()
        return reply

    def _loop(self) -> str:
        for _ in range(MAX_TOOL_ROUNDS):
            resp = _generate(self.client, self.history, self.config)
            if not resp.candidates or resp.candidates[0].content is None:
                return "Sorry, I can't help with that request."
            self.history.append(resp.candidates[0].content)
            calls = resp.function_calls or []
            if not calls:
                return (resp.text or "").strip() or "Done."
            parts = [
                types.Part(function_response=types.FunctionResponse(
                    id=call.id, name=call.name, response={"result": self._run_tool(call.name, dict(call.args or {}))},
                ))
                for call in calls
            ]
            self.history.append(types.Content(role="user", parts=parts))
        return "Ye kaam bohat lamba ho gaya, dobara thoda aasan kar ke batayein."
