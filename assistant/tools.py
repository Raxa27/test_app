"""Tools the assistant can use: notes, to-dos, expenses, reminders, and files."""

import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

from anthropic import beta_tool

from . import storage

WORKSPACE = storage.DATA_DIR / "files"
# Cloud servers usually run on UTC; set e.g. ASSISTANT_TIMEZONE=Asia/Karachi so times match the user's clock.
TIMEZONE = ZoneInfo(os.environ["ASSISTANT_TIMEZONE"]) if os.environ.get("ASSISTANT_TIMEZONE") else None


def _now() -> datetime:
    return datetime.now(TIMEZONE) if TIMEZONE else datetime.now().astimezone()


@beta_tool
def get_current_time() -> str:
    """Get the current local date, time, and weekday. Use this before scheduling reminders or filtering by date."""
    return _now().strftime("%Y-%m-%d %H:%M (%A)")


# ---------- Notes ----------

@beta_tool
def add_note(text: str, tags: str = "") -> str:
    """Save a note for the user.

    Args:
        text: The note content.
        tags: Optional comma-separated tags, e.g. "work,ideas".
    """
    notes = storage.load("notes")
    note = {"id": storage.next_id(notes), "text": text, "tags": tags, "created": _now().isoformat(timespec="minutes")}
    notes.append(note)
    storage.save("notes", notes)
    return f"Note #{note['id']} saved."


@beta_tool
def search_notes(query: str = "") -> str:
    """Search saved notes by text or tag. An empty query returns the 20 most recent notes.

    Args:
        query: Word or phrase to look for (case-insensitive).
    """
    notes = storage.load("notes")
    q = query.lower()
    hits = [n for n in notes if q in n["text"].lower() or q in n["tags"].lower()][-20:]
    if not hits:
        return "No matching notes."
    return "\n".join(f"#{n['id']} [{n['created']}] {n['text']}" + (f" (tags: {n['tags']})" if n["tags"] else "") for n in hits)


@beta_tool
def delete_note(note_id: int) -> str:
    """Delete a note by its id.

    Args:
        note_id: The note's id number.
    """
    notes = storage.load("notes")
    remaining = [n for n in notes if n["id"] != note_id]
    if len(remaining) == len(notes):
        return f"Note #{note_id} not found."
    storage.save("notes", remaining)
    return f"Note #{note_id} deleted."


# ---------- To-dos ----------

@beta_tool
def add_task(title: str, due: str = "", priority: str = "normal") -> str:
    """Add a to-do task.

    Args:
        title: What needs to be done.
        due: Optional due date as YYYY-MM-DD.
        priority: One of "low", "normal", "high".
    """
    tasks = storage.load("tasks")
    task = {"id": storage.next_id(tasks), "title": title, "due": due, "priority": priority, "done": False}
    tasks.append(task)
    storage.save("tasks", tasks)
    return f"Task #{task['id']} added."


@beta_tool
def list_tasks(include_done: bool = False) -> str:
    """List to-do tasks.

    Args:
        include_done: Also show completed tasks.
    """
    tasks = [t for t in storage.load("tasks") if include_done or not t["done"]]
    if not tasks:
        return "No tasks."
    order = {"high": 0, "normal": 1, "low": 2}
    tasks.sort(key=lambda t: (t["done"], order.get(t["priority"], 1), t["due"] or "9999"))
    return "\n".join(
        f"#{t['id']} [{'x' if t['done'] else ' '}] {t['title']} ({t['priority']}" + (f", due {t['due']}" if t["due"] else "") + ")"
        for t in tasks
    )


@beta_tool
def complete_task(task_id: int) -> str:
    """Mark a task as done.

    Args:
        task_id: The task's id number.
    """
    tasks = storage.load("tasks")
    for t in tasks:
        if t["id"] == task_id:
            t["done"] = True
            storage.save("tasks", tasks)
            return f"Task #{task_id} marked done."
    return f"Task #{task_id} not found."


# ---------- Expenses ----------

@beta_tool
def add_expense(amount: float, category: str, description: str = "", date: str = "") -> str:
    """Record money the user spent.

    Args:
        amount: Amount spent, as a number.
        category: Category such as food, transport, bills, shopping, health, other.
        description: Optional short description.
        date: Optional date as YYYY-MM-DD; defaults to today.
    """
    expenses = storage.load("expenses")
    entry = {
        "id": storage.next_id(expenses),
        "amount": amount,
        "category": category.lower(),
        "description": description,
        "date": date or _now().strftime("%Y-%m-%d"),
    }
    expenses.append(entry)
    storage.save("expenses", expenses)
    return f"Expense #{entry['id']} recorded: {amount} on {entry['category']}."


@beta_tool
def expense_summary(month: str = "") -> str:
    """Summarize spending for a month, broken down by category, with the individual entries.

    Args:
        month: Month as YYYY-MM; defaults to the current month.
    """
    month = month or _now().strftime("%Y-%m")
    items = [e for e in storage.load("expenses") if e["date"].startswith(month)]
    if not items:
        return f"No expenses recorded for {month}."
    by_cat = defaultdict(float)
    for e in items:
        by_cat[e["category"]] += e["amount"]
    lines = [f"Total for {month}: {sum(by_cat.values()):g}"]
    lines += [f"- {cat}: {amt:g}" for cat, amt in sorted(by_cat.items(), key=lambda kv: -kv[1])]
    lines.append("Entries:")
    lines += [f"#{e['id']} {e['date']} {e['amount']:g} {e['category']} {e['description']}".rstrip() for e in items]
    return "\n".join(lines)


@beta_tool
def delete_expense(expense_id: int) -> str:
    """Delete a wrongly recorded expense.

    Args:
        expense_id: The expense's id number.
    """
    expenses = storage.load("expenses")
    remaining = [e for e in expenses if e["id"] != expense_id]
    if len(remaining) == len(expenses):
        return f"Expense #{expense_id} not found."
    storage.save("expenses", remaining)
    return f"Expense #{expense_id} deleted."


# ---------- Reminders ----------

@beta_tool
def add_reminder(text: str, when: str) -> str:
    """Set a reminder. Call get_current_time first to resolve relative times like "in 2 hours" or "tomorrow".

    Args:
        text: What to remind the user about.
        when: Local date and time as "YYYY-MM-DD HH:MM" (24-hour).
    """
    try:
        due = datetime.strptime(when, "%Y-%m-%d %H:%M")
    except ValueError:
        return 'Invalid time. Use "YYYY-MM-DD HH:MM".'
    reminders = storage.load("reminders")
    r = {"id": storage.next_id(reminders), "text": text, "when": due.strftime("%Y-%m-%d %H:%M"), "sent": False}
    reminders.append(r)
    storage.save("reminders", reminders)
    return f"Reminder #{r['id']} set for {r['when']}."


@beta_tool
def list_reminders() -> str:
    """List upcoming reminders that have not fired yet."""
    pending = sorted((r for r in storage.load("reminders") if not r["sent"]), key=lambda r: r["when"])
    if not pending:
        return "No upcoming reminders."
    return "\n".join(f"#{r['id']} {r['when']} - {r['text']}" for r in pending)


@beta_tool
def cancel_reminder(reminder_id: int) -> str:
    """Cancel a reminder.

    Args:
        reminder_id: The reminder's id number.
    """
    reminders = storage.load("reminders")
    remaining = [r for r in reminders if r["id"] != reminder_id]
    if len(remaining) == len(reminders):
        return f"Reminder #{reminder_id} not found."
    storage.save("reminders", remaining)
    return f"Reminder #{reminder_id} cancelled."


def pop_due_reminders() -> list[dict]:
    """Return reminders whose time has come and mark them sent. Used by the CLI and Telegram bot."""
    reminders = storage.load("reminders")
    now = _now().strftime("%Y-%m-%d %H:%M")
    due = [r for r in reminders if not r["sent"] and r["when"] <= now]
    if due:
        for r in due:
            r["sent"] = True
        storage.save("reminders", reminders)
    return due


# ---------- Contacts & WhatsApp ----------

# Actions the user must finish on their device (e.g. tapping Send in WhatsApp).
# Collected during one Assistant.ask() call and shown by the CLI, Telegram bot, or voice page.
PENDING_ACTIONS: list[dict] = []


def _normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = "92" + digits[1:]  # Pakistani local format 03xx-xxxxxxx
    return digits


def _find_contact(name: str) -> dict | None:
    q = name.lower().strip()
    contacts = storage.load("contacts")
    return next((c for c in contacts if c["name"].lower() == q), None) or next(
        (c for c in contacts if q in c["name"].lower()), None
    )


@beta_tool
def save_contact(name: str, phone: str) -> str:
    """Save or update a contact's phone number so messages can be sent to them by name.

    Args:
        name: Contact name, e.g. "Ammi" or "Ali bhai".
        phone: Phone number in any format, e.g. "0300 1234567" or "+92 300 1234567".
    """
    number = _normalize_phone(phone)
    if len(number) < 10:
        return "That phone number looks incomplete."
    contacts = [c for c in storage.load("contacts") if c["name"].lower() != name.lower().strip()]
    contacts.append({"id": storage.next_id(contacts), "name": name.strip(), "phone": number})
    storage.save("contacts", contacts)
    return f"Saved {name}: +{number}."


@beta_tool
def list_contacts() -> str:
    """List saved contacts."""
    contacts = storage.load("contacts")
    if not contacts:
        return "No saved contacts."
    return "\n".join(f"{c['name']}: +{c['phone']}" for c in sorted(contacts, key=lambda c: c["name"].lower()))


def _resolve_recipient(to: str) -> tuple[str, str] | str:
    """Return (number, label) for a saved contact name or phone number, or an error message."""
    contact = _find_contact(to)
    if contact:
        return contact["phone"], contact["name"]
    if sum(ch.isdigit() for ch in to) >= 10:
        return _normalize_phone(to), to
    return f'No saved contact named "{to}". Ask the user for the number, then call save_contact.'


def _add_action(kind: str, label: str, url: str, confirm: bool) -> str:
    PENDING_ACTIONS.append({"type": kind, "label": label, "url": url, "confirm": confirm})
    if confirm:
        return (
            f"Ready: {label}. The app will ask the user once to confirm before doing it. "
            "End your reply with one short confirmation question in the user's language (e.g. \"Call karun?\")."
        )
    return f"Opened: {label}."


@beta_tool
def send_whatsapp(message: str, to: str = "") -> str:
    """Send a WhatsApp message. Opens WhatsApp with the message filled in, after the user confirms once.

    Write the message exactly as it should be sent, in the language the user wants.

    Args:
        message: The full message text to send.
        to: A saved contact name or a phone number. Leave empty to let the user pick the chat in WhatsApp.
    """
    number, label = "", "WhatsApp"
    if to:
        resolved = _resolve_recipient(to)
        if isinstance(resolved, str):
            return resolved + ' Or call again with to="" so they can pick the chat in WhatsApp.'
        number, label = resolved
    return _add_action("whatsapp", f"WhatsApp: {label}", f"https://wa.me/{number}?text={quote(message)}", confirm=True)


@beta_tool
def make_call(to: str) -> str:
    """Phone call someone. The phone's dialer opens after the user confirms once.

    Args:
        to: A saved contact name or a phone number.
    """
    resolved = _resolve_recipient(to)
    if isinstance(resolved, str):
        return resolved
    number, label = resolved
    return _add_action("call", f"Call: {label}", f"tel:+{number}", confirm=True)


@beta_tool
def send_sms(to: str, message: str) -> str:
    """Send a text message (SMS). The messages app opens with the text filled in, after the user confirms once.

    Args:
        to: A saved contact name or a phone number.
        message: The full message text.
    """
    resolved = _resolve_recipient(to)
    if isinstance(resolved, str):
        return resolved
    number, label = resolved
    return _add_action("sms", f"SMS: {label}", f"sms:+{number}?body={quote(message)}", confirm=True)


@beta_tool
def open_youtube(query: str) -> str:
    """Open YouTube with a search, e.g. a song, video, or channel.

    Args:
        query: What to search for, e.g. "Atif Aslam Tajdar-e-Haram".
    """
    return _add_action("open", f"YouTube: {query}", f"https://www.youtube.com/results?search_query={quote(query)}", confirm=False)


@beta_tool
def open_maps(destination: str) -> str:
    """Open Google Maps with directions to a place.

    Args:
        destination: Place name or address, e.g. "Badshahi Mosque Lahore".
    """
    url = f"https://www.google.com/maps/dir/?api=1&destination={quote(destination)}"
    return _add_action("open", f"Maps: {destination}", url, confirm=False)


@beta_tool
def open_website(url: str) -> str:
    """Open a website for the user, e.g. a news site, Google search, or a link they asked for.

    Args:
        url: Full http(s) address.
    """
    if not url.startswith(("https://", "http://")):
        return "Only http(s) links can be opened."
    return _add_action("open", url, url, confirm=False)


# ---------- Files (sandboxed to data/files) ----------

def _safe_path(name: str) -> Path:
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    path = (WORKSPACE / name).resolve()
    if WORKSPACE.resolve() not in path.parents:
        raise ValueError("Path must stay inside the assistant's files folder.")
    return path


@beta_tool
def write_file(filename: str, content: str) -> str:
    """Create or overwrite a text file (letters, lists, drafts, code) in the assistant's files folder.

    Args:
        filename: File name, e.g. "letter.txt" or "plans/trip.md".
        content: Full text content of the file.
    """
    try:
        path = _safe_path(filename)
    except ValueError as e:
        return str(e)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return f"Saved {path.relative_to(WORKSPACE.resolve())} ({len(content)} chars)."


@beta_tool
def read_file(filename: str) -> str:
    """Read a text file from the assistant's files folder.

    Args:
        filename: File name to read.
    """
    try:
        path = _safe_path(filename)
    except ValueError as e:
        return str(e)
    if not path.is_file():
        return f"{filename} not found."
    return path.read_text(encoding="utf-8")[:50_000]


@beta_tool
def list_files() -> str:
    """List files in the assistant's files folder."""
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    files = [str(p.relative_to(WORKSPACE)) for p in sorted(WORKSPACE.rglob("*")) if p.is_file()]
    return "\n".join(files) if files else "No files yet."


# Anthropic-hosted tools: no local code needed.
SERVER_TOOLS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 5},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 5},
]

LOCAL_TOOLS = [
    get_current_time,
    add_note, search_notes, delete_note,
    add_task, list_tasks, complete_task,
    add_expense, expense_summary, delete_expense,
    add_reminder, list_reminders, cancel_reminder,
    save_contact, list_contacts, send_whatsapp, make_call, send_sms,
    open_youtube, open_maps, open_website,
    write_file, read_file, list_files,
]

ALL_TOOLS = [*LOCAL_TOOLS, *SERVER_TOOLS]
