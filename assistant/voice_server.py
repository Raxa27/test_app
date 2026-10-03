"""Siri-style voice assistant in the browser: python -m assistant.voice_server

Open http://localhost:8000 in Chrome or Edge, tap the orb, and speak.

Environment variables:
  ANTHROPIC_API_KEY    your Claude API key
  ASSISTANT_PASSWORD   optional; required when the server is reachable from other devices
  ASSISTANT_HOST       default 127.0.0.1, or 0.0.0.0 when PORT is set (cloud hosts like Railway)
  ASSISTANT_PORT       default $PORT if set, else 8000
"""

import hmac
import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import anthropic

from .agent import AssistantError, create_assistant
from .location import describe as describe_location
from .tools import pop_due_reminders

log = logging.getLogger("voice_server")
STATIC = Path(__file__).resolve().parent / "static"
PAGE = (STATIC / "voice.html").read_bytes()
STATIC_FILES = {
    "/manifest.json": ("manifest.json", "application/manifest+json"),
    "/sw.js": ("sw.js", "text/javascript"),
    "/icon-192.png": ("icon-192.png", "image/png"),
    "/icon-512.png": ("icon-512.png", "image/png"),
}
PASSWORD = os.environ.get("ASSISTANT_PASSWORD", "")
MAX_BODY = 20_000

assistant = create_assistant(voice=True)
assistant_lock = threading.Lock()
last_location = {"place": None}
SAY_MARKER = "[[say]]"


def _with_location(text: str, location) -> str:
    """Prefix the message with the user's place when it is new or has changed."""
    try:
        lat, lng = float(location["lat"]), float(location["lng"])
    except (TypeError, KeyError, ValueError):
        return text
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return text
    place = describe_location(lat, lng)
    if place == last_location["place"]:
        return text
    last_location["place"] = place
    return f"[Context: user's current location: {place}]\n{text}"


def _split_speech(reply: str) -> tuple[str, str | None]:
    """Separate the on-screen reply from the Devanagari line meant only for text-to-speech."""
    if SAY_MARKER not in reply:
        return reply.strip(), None
    shown, _, spoken = reply.partition(SAY_MARKER)
    return shown.strip() or spoken.strip(), spoken.strip() or None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log.info("%s %s", self.address_string(), fmt % args)

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, data: dict) -> None:
        self._send(status, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def _authorized(self) -> bool:
        if not PASSWORD:
            return True
        return hmac.compare_digest(self.headers.get("X-Assistant-Password", ""), PASSWORD)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, PAGE, "text/html; charset=utf-8")
        elif self.path in STATIC_FILES:
            name, content_type = STATIC_FILES[self.path]
            self._send(200, (STATIC / name).read_bytes(), content_type)
        elif self.path == "/api/config":
            self._json(200, {"password_required": bool(PASSWORD)})
        elif self.path == "/api/reminders":
            if not self._authorized():
                return self._json(401, {"error": "Wrong password."})
            self._json(200, {"reminders": [r["text"] for r in pop_due_reminders()]})
        else:
            self._json(404, {"error": "Not found."})

    def do_POST(self):
        if not self._authorized():
            return self._json(401, {"error": "Wrong password."})
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            return self._json(413, {"error": "Message too long."})
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "Invalid JSON."})

        if self.path == "/api/reset":
            with assistant_lock:
                assistant.reset()
                last_location["place"] = None
            return self._json(200, {"ok": True})
        if self.path != "/api/ask":
            return self._json(404, {"error": "Not found."})

        text = str(data.get("text", "")).strip()
        if not text:
            return self._json(400, {"error": "Empty message."})
        try:
            with assistant_lock:
                reply = assistant.ask(_with_location(text, data.get("location")))
                actions = assistant.last_actions
        except AssistantError as e:
            return self._json(502, {"error": str(e)})
        except anthropic.AuthenticationError:
            return self._json(500, {"error": "API key is missing or invalid."})
        except anthropic.RateLimitError:
            return self._json(429, {"error": "Too many requests, try again in a minute."})
        except anthropic.APIConnectionError:
            return self._json(502, {"error": "Could not reach the AI service."})
        except anthropic.APIStatusError as e:
            return self._json(502, {"error": f"AI service error {e.status_code}."})
        shown, speech = _split_speech(reply)
        self._json(200, {"reply": shown, "speech": speech, "actions": actions})


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    cloud_port = os.environ.get("PORT")  # set by Railway and similar hosts
    host = os.environ.get("ASSISTANT_HOST", "0.0.0.0" if cloud_port else "127.0.0.1")
    port = int(os.environ.get("ASSISTANT_PORT") or cloud_port or "8000")
    if host not in ("127.0.0.1", "localhost") and not PASSWORD:
        raise SystemExit("Set ASSISTANT_PASSWORD before exposing the assistant to other devices.")
    server = ThreadingHTTPServer((host, port), Handler)
    log.info("Voice assistant running at http://%s:%d  (Ctrl+C to stop)", "localhost" if host == "127.0.0.1" else host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
