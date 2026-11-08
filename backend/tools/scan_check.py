"""Print what the task scanner finds in a file:  python tools/scan_check.py <file>"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import task_scanner  # noqa: E402

path = sys.argv[1]
with open(path, "rb") as f:
    result = task_scanner.scan(f.read(), os.path.basename(path))
print("read by:", result["method"])
print("title:", result["title"])
print("dates:", result["start_date"], "->", result["end_date"], "| time:", result["due_time"])
print("schedule items:", len(result["items"]))
for item in result["items"]:
    print("  ", item["start_date"], item["end_date"], "|", item["title"])
