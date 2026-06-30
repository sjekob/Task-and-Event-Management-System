"""Generates events_erd.drawio (+ .svg) — accurate ERD from actual orm_models.py.

Run: python docs/build_events_erd.py
"""
import html
import os

ROW_H = 16
HEAD_H = 26
SEP = 10
COL_W = 220

# name -> (x, y, width, [attributes])
TABLES = {
    "PERSONNEL": (40, 50, 210, [
        "personnel_id (PK)",
        "full_name",
        "role",
        "* Coordinator",
        "* Dean",
        "* Principal",
    ]),
    "EVENTS": (350, 40, 240, [
        "id (PK)",
        "created_by (FK PERSONNEL)",
        "title",
        "nature",
        "target_date",
        "venue",
        "proposed_budget",
        "fund_source",
        "focal_name, focal_role",
        "rationale, objectives",
        "status",
    ]),
    "EVENT_OUTPUTS": (700, 20, 200, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "output_text",
    ]),
    "EVENT_PARTICIPANTS": (700, 180, 210, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "category",
        "male_count, female_count",
    ]),
    "EVENT_METHODOLOGY": (950, 20, 210, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "phase_no",
        "stage, activities",
    ]),
    "EVENT_ACTIVITY": (950, 180, 210, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "activity_day",
        "activity_time",
        "activity_name, speaker",
    ]),
    "EVENT_BUDGET_ITEMS": (1200, 20, 220, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "item_category",
        "item_name",
        "quantity, cost_per_unit",
        "total_cost",
    ]),
    "EVENT_INDICATOR": (1200, 220, 210, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "label",
    ]),
    "EVENT_SIGNATORY": (1200, 360, 220, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "role",
        "signatory_name",
        "signatory_title",
        "sequence",
    ]),
    "EVENT_COMMITTEE": (700, 380, 220, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "committee_type",
        "title",
    ]),
    "COMMITTEE_MEMBER": (950, 380, 240, [
        "id (PK)",
        "event_committee_id (FK)",
        "personnel_id (FK PERSONNEL)",
        "member_name",
        "designation",
        "terms_of_reference",
        "output",
    ]),
    "EVENT_EVALUATION": (600, 350, 240, [
        "id (PK)",
        "event_id (FK EVENTS)",
        "evaluator_id (FK PERSONNEL)",
        "evaluator_name",
        "planning_score",
        "objectives_score",
        "personnel_score",
        "time_mgmt_score",
        "engagement_score",
        "resource_score",
        "feedback_comments",
    ]),
    "ACTIVITY_EVENTS": (40, 350, 240, [
        "id (PK)",
        "created_by (FK PERSONNEL)",
        "title",
        "description",
        "event_date",
        "status",
        "created_at",
    ]),
}

# (src, tgt, label) — solid association
ASSOCIATIONS = [
    ("PERSONNEL", "EVENTS", "creates"),
    ("EVENTS", "EVENT_OUTPUTS", "contains"),
    ("EVENTS", "EVENT_PARTICIPANTS", "contains"),
    ("EVENTS", "EVENT_METHODOLOGY", "contains"),
    ("EVENTS", "EVENT_ACTIVITY", "contains"),
    ("EVENTS", "EVENT_BUDGET_ITEMS", "contains"),
    ("EVENTS", "EVENT_INDICATOR", "contains"),
    ("EVENTS", "EVENT_SIGNATORY", "contains"),
    ("EVENTS", "EVENT_COMMITTEE", "contains"),
    ("EVENT_COMMITTEE", "COMMITTEE_MEMBER", "composes"),
    ("PERSONNEL", "COMMITTEE_MEMBER", "assigned_to"),
    ("EVENTS", "EVENT_EVALUATION", "receives"),
    ("PERSONNEL", "EVENT_EVALUATION", "evaluates"),
    ("PERSONNEL", "ACTIVITY_EVENTS", "creates"),
]

def esc(s):
    return html.escape(s, quote=True)

def box_h(attrs):
    return HEAD_H + len(attrs) * ROW_H + 2 * SEP + 6

def table_value(name, attrs):
    raw = (f'<div style="text-align:center"><b>{name}</b></div>'
           '<hr size="1">'
           + '<br>'.join(attrs))
    return esc(raw)

def build_drawio():
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    ids = {}
    for i, (name, (x, y, w, attrs)) in enumerate(TABLES.items(), start=2):
        tid = f"t{i}"
        ids[name] = tid
        h = box_h(attrs)
        style = ("rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;align=left;"
                 "spacingLeft=8;spacingTop=4;fillColor=#ffffff;strokeColor=#000000;fontSize=10;")
        cells.append(
            f'<mxCell id="{tid}" value="{table_value(name, attrs)}" style="{style}" '
            f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )

    e = 0
    def add_edge(src, tgt, label=""):
        nonlocal e
        e += 1
        eid = f"e{e}"
        style = "endArrow=crow;html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;"
        cells.append(
            f'<mxCell id="{eid}" value="{esc(label)}" style="{style}" edge="1" parent="1" '
            f'source="{ids[src]}" target="{ids[tgt]}"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )

    for src, tgt, label in ASSOCIATIONS:
        add_edge(src, tgt, label)

    body = "\n        ".join(cells)
    return (
        '<mxfile host="app.diagrams.net" type="device">\n'
        '  <diagram id="events-erd" name="Events ERD">\n'
        '    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
        'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1400" '
        'math="0" shadow="0">\n'
        '      <root>\n'
        f'        {body}\n'
        '      </root>\n'
        '    </mxGraphModel>\n'
        '  </diagram>\n'
        '</mxfile>\n'
    )

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "events_erd.drawio"), "w", encoding="utf-8") as f:
        f.write(build_drawio())
    print("wrote events_erd.drawio — accurate Events ERD from orm_models.py")
