"""
rich_text.py — Server-side whitelist for the proposal form's rich text.

Formatted proposal fields arrive as `comments.rich` ({field: html}). Only
bold / italic / underline / font size / line breaks survive; every other tag,
attribute and style is dropped (OWASP A03: stored XSS), and tags are balanced.
The client sanitizes again before rendering, but storage never holds raw HTML.
"""

import json
import re
from html import escape
from html.parser import HTMLParser
from typing import Optional

_ALIASES = {"strong": "b", "em": "i", "p": "div", "font": "span"}
_ALLOWED = {"b", "i", "u", "br", "span", "div"}
_DROP_CONTENT = {"script", "style", "iframe", "object", "embed", "template",
                 "svg", "math", "textarea", "title", "noscript"}
_LEGACY_SIZES = {"1": 0.7, "2": 0.85, "3": 1, "4": 1.15, "5": 1.3, "6": 1.5, "7": 2}
_RICH_KEYS = {"title", "venue", "focalRole", "rationale", "objectives", "monitoring"}
_MAX_LEN = 20000


def _safe_style(tag: str, attrs: dict) -> str:
    css = (attrs.get("style") or "").lower()
    out = []
    size = None
    m = re.search(r"font-size\s*:\s*([\d.]+)\s*(em|rem|%|px|pt)?", css)
    if m:
        v, unit = float(m.group(1)), m.group(2) or "px"
        size = v / 100 if unit == "%" else v / 14.67 if unit == "px" else v / 11 if unit == "pt" else v
    if tag == "font" and attrs.get("size") in _LEGACY_SIZES:
        size = _LEGACY_SIZES[attrs["size"]]
    if size is not None and size > 0:
        size = round(min(2.5, max(0.6, size)), 2)
        if size != 1:
            out.append(f"font-size:{size:g}em")
    if re.search(r"font-weight\s*:\s*(bold|[6-9]00)", css):
        out.append("font-weight:bold")
    if re.search(r"font-style\s*:\s*italic", css):
        out.append("font-style:italic")
    if re.search(r"text-decoration[a-z-]*\s*:[^;]*underline", css):
        out.append("text-decoration:underline")
    align = re.search(r"text-align\s*:\s*(left|center|right|justify)", css)
    if align and tag in ("div", "p"):
        out.append(f"text-align:{align.group(1)}")
    return f' style="{";".join(out)}"' if out else ""


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.stack: list[str] = []
        self.skip = 0  # depth inside a dropped-with-content element

    def handle_starttag(self, raw, attrs):
        if raw in _DROP_CONTENT:
            self.skip += 1
            return
        if self.skip:
            return
        tag = _ALIASES.get(raw, raw)
        if tag not in _ALLOWED:
            return
        if tag == "br":
            self.out.append("<br>")
            return
        style = _safe_style(raw, {k.lower(): v or "" for k, v in attrs}) if tag in ("span", "div") else ""
        self.stack.append(tag)
        self.out.append(f"<{tag}{style}>")

    def handle_startendtag(self, raw, attrs):
        if not self.skip and raw == "br":
            self.out.append("<br>")

    def handle_endtag(self, raw):
        if raw in _DROP_CONTENT:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        tag = _ALIASES.get(raw, raw)
        if tag not in self.stack:
            return
        while self.stack:
            t = self.stack.pop()
            self.out.append(f"</{t}>")
            if t == tag:
                break

    def handle_data(self, data):
        if not self.skip:
            self.out.append(escape(data, quote=False))

    def result(self) -> str:
        self.close()
        while self.stack:
            self.out.append(f"</{self.stack.pop()}>")
        return "".join(self.out)


def sanitize_rich(html: object) -> str:
    p = _Sanitizer()
    p.feed(str(html or "")[:_MAX_LEN])
    return p.result()


def clean_comments(raw: Optional[str]) -> Optional[str]:
    """The event `comments` JSON with its `rich` map whitelisted (other content untouched)."""
    if not raw:
        return raw
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return raw
    if not isinstance(data, dict) or "rich" not in data:
        return raw
    rich = data.get("rich")
    clean: dict = {}
    if isinstance(rich, dict):
        for k, v in rich.items():
            if k in _RICH_KEYS and isinstance(v, str):
                clean[k] = sanitize_rich(v)
            elif k == "outputs" and isinstance(v, list):
                clean[k] = [sanitize_rich(x) if isinstance(x, str) else "" for x in v[:50]]
    data["rich"] = clean
    return json.dumps(data, ensure_ascii=False)
