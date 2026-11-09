"""
mailer.py — Outgoing email (account credentials, notifications) over SMTP.

Configured from the environment (.env → docker-compose.yml). For testing, use a
Mailtrap Email Testing inbox: every message is caught there instead of being
delivered. SMTP settings: Mailtrap → Email Testing → your inbox → SMTP.

    MAIL_HOST=sandbox.smtp.mailtrap.io
    MAIL_PORT=2525
    MAIL_USERNAME=...           # from Mailtrap
    MAIL_PASSWORD=...           # from Mailtrap
    MAIL_FROM=TaskNet <no-reply@tasknet.local>
    APP_URL=http://localhost:5173   # where links in emails point

Without MAIL_HOST nothing is sent (the app works the same, just no email).
Emails go on a queue that one background thread works through, so a request
never waits on the mail server and a failure is only logged. A burst (a task
posted to the whole faculty) is sent over a single SMTP connection and login.
"""
import logging
import os
import queue
import smtplib
import threading
import time
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from html import escape

log = logging.getLogger("tasknet.mail")

BATCH_WAIT_S = 1.0   # gather a burst this long before connecting
BATCH_MAX = 50       # most messages per connection

_queue: "queue.Queue[EmailMessage]" = queue.Queue()
_worker_lock = threading.Lock()
_worker = None


def enabled() -> bool:
    return bool(os.getenv("MAIL_HOST", "").strip())


def app_url(path: str = "") -> str:
    base = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")
    return f"{base}{path}"


def _message(to: str, subject: str, text: str, html: str) -> EmailMessage:
    name, addr = parseaddr(os.getenv("MAIL_FROM", "TaskNet <no-reply@tasknet.local>"))
    msg = EmailMessage()
    msg["From"] = formataddr((name or "TaskNet", addr or "no-reply@tasknet.local"))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def _connect() -> smtplib.SMTP:
    s = smtplib.SMTP(os.getenv("MAIL_HOST", "").strip(), int(os.getenv("MAIL_PORT", "2525") or 2525), timeout=15)
    s.ehlo()
    if s.has_extn("starttls"):
        s.starttls()
        s.ehlo()
    user = os.getenv("MAIL_USERNAME", "")
    if user:
        s.login(user, os.getenv("MAIL_PASSWORD", ""))
    return s


def _deliver(batch: list):
    """Sends [batch] over one connection, reconnecting once if the server drops it."""
    s = None
    try:
        for i, msg in enumerate(batch):
            for retry in (False, True):
                if s is None:
                    try:
                        s = _connect()
                    except Exception as e:  # unreachable or wrong login: the rest would fail too
                        log.warning("Email not sent to %d recipient(s): %s", len(batch) - i, e)
                        return
                try:
                    s.send_message(msg)
                    break
                except smtplib.SMTPServerDisconnected as e:
                    s = None  # the server dropped the connection: reconnect once
                    if retry:
                        log.warning("Email to %s failed: %s", msg["To"], e)
                except Exception as e:  # this message only (e.g. a refused address)
                    log.warning("Email to %s failed: %s", msg["To"], e)
                    break
    finally:
        if s is not None:
            try:
                s.quit()
            except Exception:
                pass


def _work():
    while True:
        batch = [_queue.get()]
        until = time.monotonic() + BATCH_WAIT_S
        while len(batch) < BATCH_MAX:
            left = until - time.monotonic()
            if left <= 0:
                break
            try:
                batch.append(_queue.get(timeout=left))
            except queue.Empty:
                break
        _deliver(batch)


def send(to: str, subject: str, text: str, html: str):
    """Queues one email (no-op without MAIL_HOST or a recipient)."""
    global _worker
    to = (to or "").strip()
    if not enabled() or "@" not in to:
        return
    _queue.put(_message(to, subject, text, html))
    if _worker is None:
        with _worker_lock:
            if _worker is None:
                _worker = threading.Thread(target=_work, name="mailer", daemon=True)
                _worker.start()


def _layout(title: str, body_html: str, button: tuple = None) -> str:
    btn = (f'<p style="margin:24px 0"><a href="{escape(button[1])}" style="background:#D92243;color:#fff;'
           f'text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">{escape(button[0])}</a></p>') if button else ""
    return (f'<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2B2220">'
            f'<div style="background:#5a1120;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:700">TaskNet</div>'
            f'<div style="border:1px solid #eee;border-top:0;padding:20px;border-radius:0 0 10px 10px">'
            f'<h2 style="margin:0 0 12px;font-size:18px">{escape(title)}</h2>{body_html}{btn}'
            f'<p style="color:#7D6F68;font-size:12px;margin-top:24px">This is an automated message from TaskNet.</p></div></div>')


def send_account_created(to: str, full_name: str, username: str, password: str, role: str):
    """The new account's sign-in details (the password the personnel manager set)."""
    login = app_url("/login")
    text = (f"Hello {full_name},\n\nA TaskNet account was created for you ({role}).\n\n"
            f"Username: {username}\nPassword: {password}\n\nSign in at {login}. Keep these details private.\n")
    html = _layout("Your TaskNet account", (
        f"<p>Hello {escape(full_name)},</p><p>A TaskNet account was created for you as <b>{escape(role)}</b>.</p>"
        f'<table style="border-collapse:collapse;font-size:14px"><tr><td style="padding:4px 12px 4px 0;color:#7D6F68">Username</td>'
        f"<td><b>{escape(username)}</b></td></tr><tr><td style=\"padding:4px 12px 4px 0;color:#7D6F68\">Password</td>"
        f"<td><b>{escape(password)}</b></td></tr></table>"
        f"<p>Keep these details private.</p>"), ("Sign in to TaskNet", login))
    send(to, "Your TaskNet account", text, html)


_PATHS = {"task": "/my-tasks", "event": "/events"}


def send_notification(to: str, full_name: str, kind: str, title: str, body: str = ""):
    """The email copy of an in-app notification."""
    link = app_url(_PATHS.get(kind, "/dashboard"))
    text = f"Hello {full_name},\n\n{title}\n{body}\n\nOpen TaskNet: {link}\n"
    html = _layout(title, f"<p>Hello {escape(full_name)},</p>" + (f"<p>{escape(body)}</p>" if body else ""), ("Open TaskNet", link))
    send(to, f"TaskNet: {title}", text, html)
