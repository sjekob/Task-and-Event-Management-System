"""
calendar_plan.py — The reports a school calendar calls for.

A calendar entry is not itself a task: "End of Term 1" is the basis for the
task teachers actually do, "Submission of Term 1 Grades" to their dean. Each
rule below turns one kind of entry into the reports it requires; entries no
rule covers (holidays, breaks, national tests) produce no task. Holidays and
weekends still matter: a due date never lands on one.

Every proposal carries its `basis` (the entry and date it came from) and a
`route` (see ROUTES) saying who submits it to whom.
"""
import re
from datetime import date, timedelta

# A route is "<assignees>><reviewer>": "teacher>dean" gives the task to every
# teacher, each submitting to the dean of their grade level; "subject>adviser"
# gives each section's subject teachers a task of that section, submitted to its
# adviser; "adviser>dean" gives it to every adviser, submitted to the dean of
# their section's grade; "dean>registrar" gives it to every dean, submitted to
# the registrar. See calendar_tasks.py.
# teacher, each submitting to the dean of their grade level; ">principal" means
# to whoever posts the calendar. "later" posts it with nobody assigned yet.
ROUTES = ("subject>adviser", "adviser>dean", "dean>registrar", "teacher>dean", "teacher>principal", "dean>principal",
          "coordinator>principal", "later")

_HOLIDAY = re.compile(
    r"holiday|christmas|new year|all saints|all souls|rizal day|bonifacio day|independence day|"
    r"labou?r day|eid|heroes day|araw ng kagitingan|holy (?:week|thursday|friday)|no classes|"
    r"feast of|immaculate concepcion|ninoy aquino|edsa|undas", re.I)
_NATIONAL_TEST = re.compile(r"\bnat\b|\bpept\b|\bncae\b|national (?:achievement|career)|\balst\b", re.I)
_EXAM = re.compile(r"examination|\bexams?\b|periodical test|quarterly test", re.I)
_SUMMATIVE = re.compile(r"summative", re.I)
# Reading and numeracy assessments run in a testing window (BOSY / MOSY / EOSY).
_ASSESSMENT = re.compile(r"\b(?:[bme]osy|crla|rma|phil-?iri)\b", re.I)
_WINDOW = re.compile(r"\b([bme]osy)\b", re.I)
_ORDINAL = re.compile(r"\b(first|second|third|fourth|1st|2nd|3rd|4th)\b", re.I)
_END_OF_YEAR = re.compile(r"end of (?:the )?school year|last day of classes|end of classes", re.I)
_END_OF_TERM = re.compile(r"end of (?:the )?(?:\w+\s+)?(?:term|quarter|semester|grading period)", re.I)
_GRADE_DEADLINE = re.compile(r"(?:submi(?:t|ssion)|deadline|encoding).*grades|grades.*(?:submi(?:t|ssion)|deadline)", re.I)
_REPORT_CARDS = re.compile(r"distribution of (?:report )?cards|report cards?|card day|parent[- ]teacher conference|\bptc\b", re.I)
_OPENING = re.compile(r"opening of (?:classes|school)|start of (?:classes|(?:the )?school year)|first day of (?:classes|school)", re.I)
_ACTIVITY = re.compile(
    r"brigada|celebration|culmination|pagbasa|teachers'? day|teachers’ day|intramurals?|sports|festival|"
    r"\bfair\b|contest|competition|program(?:me)?\b|recognition|graduation|moving up|drill", re.I)
_TRAINING = re.compile(r"\binset\b|in-service|training|seminar|workshop|\blac\b", re.I)
_PERIOD = re.compile(r"\b((?:term|quarter|semester|grading period)\s*\d+|(?:first|second|third|fourth|1st|2nd|3rd|4th)\s+"
                     r"(?:term|quarter|semester|grading period))\b", re.I)


def _d(s: str) -> date:
    return date.fromisoformat(s)


def _long(d: date) -> str:
    return f"{d.strftime('%B')} {d.day}, {d.year}"


class _Planner:
    """Builds the proposals for one calendar, keeping due dates on school days."""

    def __init__(self, entries: list):
        self.holidays = set()
        for e in entries:
            if _HOLIDAY.search(e["title"]):
                s, t = _d(e["start_date"]), _d(e["end_date"])
                self.holidays.update(s + timedelta(days=n) for n in range((t - s).days + 1))
        self.entries = [e for e in entries if not _HOLIDAY.search(e["title"])]
        self.out = []

    def school_day(self, d: date, step: int = 1) -> date:
        while d.weekday() >= 5 or d in self.holidays:
            d += timedelta(days=step)
        return d

    def add(self, entry: dict, title: str, start: date, due: date, route: str, instructions: str, selected: bool = True):
        moved = self.school_day(due, -1 if due < _d(entry["start_date"]) else 1)
        # The rules wrote the date before it moved off a weekend or holiday.
        instructions, due = instructions.replace(_long(due), _long(moved)), moved
        start = min(start, due)
        # One report per period: an explicit deadline or an earlier rule wins.
        if any(p["title"].lower() == title.lower() and abs((_d(p["end_date"]) - due).days) <= 10 for p in self.out):
            return None
        when = _long(_d(entry["start_date"])) if entry["start_date"] == entry["end_date"] else \
            f"{_long(_d(entry['start_date']))} to {_long(_d(entry['end_date']))}"
        row = {
            "title": title, "start_date": start.isoformat(), "end_date": due.isoformat(),
            "basis": f"{entry['title']} · {when}", "source": entry["title"], "source_date": when,
            "source_start": entry["start_date"], "route": route, "selected": selected,
            "kind": "report" if selected else "optional",
            "instructions": f"{instructions}\n\nBasis: {entry['title']} ({when}) in the school calendar.",
        }
        self.out.append(row)
        return row

    def report_cards_after(self, d: date):
        """The first report-card day after [d], if the calendar has one."""
        days = sorted(_d(e["start_date"]) for e in self.entries if _REPORT_CARDS.search(e["title"]) and _d(e["start_date"]) > d)
        return days[0] if days else None


def _period(title: str) -> str:
    m = _PERIOD.search(title)
    return m.group(1).title() if m else ""


def _grades(p: _Planner, e: dict, start: date, due: date):
    """The end of a term passes the grades up three steps, a few school days apart:
    subject teachers give each section's summary of grades to its adviser; the
    adviser sends the class's consolidated summary to the dean; the dean submits
    the grade level's consolidation to the registrar."""
    per = _period(e["title"])
    label = f"{per} Summary of Grades" if per else "Summary of Grades"
    row = p.add(e, f"Submission of {label}", start, due, "subject>adviser",
                f"Submit your {label if per else 'summary of grades'} for this section, in your subject, to the section's "
                f"adviser on or before {_long(due)}, with the class record.")
    if not row:
        return
    given = _d(row["end_date"])
    row = p.add(e, f"Submission of Consolidated {label}", given, given + timedelta(days=3), "adviser>dean",
                f"Consolidate the summaries of grades your subject teachers submitted for your class and submit the "
                f"consolidated summary to your dean on or before {_long(given + timedelta(days=3))}.")
    if not row:
        return
    given = _d(row["end_date"])
    p.add(e, f"Submission of {per + ' ' if per else ''}Grade Level Consolidation of Grades", given, given + timedelta(days=3),
          "dean>registrar", f"Consolidate your advisers' summaries of grades for your grade level and submit the "
                            f"consolidation to the registrar on or before {_long(given + timedelta(days=3))}.")


def plan_calendar_tasks(entries: list) -> list:
    """The reports a scanned calendar calls for, earliest due first."""
    p = _Planner(entries)
    # Grade deadlines the calendar states outright come first, so inferred ones defer to them.
    for e in p.entries:
        if _GRADE_DEADLINE.search(e["title"]):
            _grades(p, e, _d(e["start_date"]), _d(e["end_date"]))
    for e in p.entries:
        t, start, end = e["title"], _d(e["start_date"]), _d(e["end_date"])
        per = _period(t)
        if _NATIONAL_TEST.search(t) or _GRADE_DEADLINE.search(t):
            continue
        if _ASSESSMENT.search(t):
            if re.search(r"start of", t, re.I):
                continue          # results are due when the window ends
            w = _WINDOW.search(t)
            name = f"{w.group(1).upper()} Assessment Results" if w else "Assessment Results"
            p.add(e, f"Submission of {name} (CRLA, RMA, Phil-IRI)", end, end + timedelta(days=5), "adviser>dean",
                  "Submit your class's assessment results and the summary per learner to your dean.")
        elif _SUMMATIVE.search(t):
            nth = _ORDINAL.search(t)
            label = " ".join(x for x in (per, nth.group(1).title() if nth else "", "Summative Test") if x)
            p.add(e, f"Submission of {label} Results", end, end + timedelta(days=5), "teacher>dean",
                  f"Check the {label}, record the scores in your class record and submit the results to your dean.")
        elif _EXAM.search(t):
            label = f"{per} Examination" if per else "Examination"
            p.add(e, f"Submission of {label} Test Questions and TOS", start - timedelta(days=12), start - timedelta(days=5),
                  "teacher>dean", f"Submit the test questions and Table of Specifications for the {label if per else 'examination'} "
                  f"to your dean for checking on or before {_long(start - timedelta(days=5))}.")
            p.add(e, f"Submission of {label} Item Analysis", end + timedelta(days=1), end + timedelta(days=5), "teacher>dean",
                  "Check the papers, then submit the item analysis and the results per class to your dean.")
            # No "End of Term" entry follows within a month: grades are due a week after the exam.
            if not any(_END_OF_TERM.search(x["title"]) and 0 <= (_d(x["end_date"]) - end).days <= 31 for x in p.entries):
                _grades(p, e, end + timedelta(days=1), end + timedelta(days=7))
        elif _END_OF_YEAR.search(t):
            p.add(e, "Submission of Final Grades and School Forms (SF5, SF10)", end, end + timedelta(days=5), "adviser>dean",
                  "Submit the final grades, the Report on Promotion (SF5) and the learners' permanent records (SF10) to your dean.")
        elif _END_OF_TERM.search(t):
            cards = p.report_cards_after(end)
            due = min([end + timedelta(days=5), *([cards - timedelta(days=8)] if cards and cards - timedelta(days=8) > end else [])])
            _grades(p, e, end, due)
        elif _REPORT_CARDS.search(t):
            p.add(e, "Preparation of Report Cards (SF9)", start - timedelta(days=7), start - timedelta(days=1), "adviser>dean",
                  f"Prepare the report cards (SF9) of your class and have your dean check them before {_long(start)}.")
        elif _OPENING.search(t):
            p.add(e, "Submission of School Form 1 (School Register)", start, start + timedelta(days=14), "adviser>dean",
                  "Submit the School Register (SF1) of your class, with the enrolled learners, to your dean.")
        elif _TRAINING.search(t):
            p.add(e, f"Submission of Outputs and Certificates: {t}", end, end + timedelta(days=5), "teacher>principal",
                  "Submit your outputs and certificate of attendance from the training.", selected=False)
        elif _ACTIVITY.search(t):
            p.add(e, f"Narrative Report: {t}", end, end + timedelta(days=5), "coordinator>principal",
                  "Submit a narrative report with photos and the attendance of the activity.", selected=False)
    today = date.today().isoformat()
    for r in p.out:
        r["past"] = r["end_date"] < today
        if r["past"]:
            r["selected"] = False
    # In calendar order, each entry's tasks together (the dialog groups them under the entry).
    return sorted(p.out, key=lambda r: (r["source_start"], r["source"], r["end_date"]))
