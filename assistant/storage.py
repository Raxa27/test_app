"""Simple JSON file storage for the assistant's personal data."""

import json
import os
import threading
from pathlib import Path

DATA_DIR = Path(os.environ.get("ASSISTANT_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
_lock = threading.Lock()


def _path(name: str) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR / f"{name}.json"


def load(name: str) -> list:
    path = _path(name)
    if not path.exists():
        return []
    with _lock, path.open(encoding="utf-8") as f:
        return json.load(f)


def save(name: str, items: list) -> None:
    path = _path(name)
    tmp = path.with_suffix(".tmp")
    with _lock:
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        tmp.replace(path)


def next_id(items: list) -> int:
    return max((item["id"] for item in items), default=0) + 1
