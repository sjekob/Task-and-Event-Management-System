"""Generates tasknet_erd.drawio — the final TaskNet ERD (3NF, corrected).

Corrections applied vs. the source diagram:
  - removed TASK.comment_id (wrong cardinality; COMMENT.task_id already exists)
  - removed PERSONNEL.personnel_role_id (M:N role handled via PERSONNEL_ROLE)
  - fixed typos: feedback_comments, MEMBERS.personnel_id, COORDINATOR_TYPE PK
Run: python docs/build_erd_drawio.py
"""
import html
import os

# entity -> (x, y, [ (marker, field), ... ])   marker in {'PK','FK',''}
ENTITIES = {
    "ROLES": (40, 900, [("PK", "roles_id"), ("", "roles")]),
    "PERSONNEL_ROLE": (300, 880, [("PK", "personnel_role_id"), ("FK", "personnel_id"), ("FK", "roles_id")]),
    "PERSONNEL": (620, 360, [
        ("PK", "personnel_id"), ("", "firstName"), ("", "middleName"), ("", "lastName"),
        ("", "suffix"), ("", "username"), ("", "password"), ("", "email"),
        ("", "contactNumber"), ("", "birthdate"), ("", "isActive"), ("", "tinNumber"),
        ("", "GSISNumber"), ("", "PHICNumber"), ("", "address"), ("", "plantillaNumber"),
        ("", "date_of_appointment"), ("", "hdmfNumber"),
    ]),
    "SUBJECT": (380, 60, [("PK", "subject_id"), ("", "subject")]),
    "GRADE_LEVEL": (1000, 40, [("PK", "grade_level_id"), ("", "grade_level")]),
    "LOAD_ASSIGNMENT": (640, 20, [
        ("PK", "load_assign_id"), ("FK", "personnel_id"), ("FK", "subject_id"),
        ("FK", "grade_level_id"), ("", "createdAt"), ("", "updatedAt"),
    ]),
    "DEAN_ASSIGNMENT": (1000, 300, [("PK", "dean_assignment_id"), ("FK", "grade_level_id"), ("FK", "personnel_id")]),
    "COORDINATOR_TYPE": (1000, 470, [("PK", "coordinator_type_id"), ("", "coordinator_type"), ("FK", "personnel_id")]),
    "PERFORMANCE_SUMMARY": (300, 360, [
        ("PK", "summary_id"), ("", "period"), ("", "total_appraisal_points"),
        ("", "average_event_score"), ("", "average_special_task_score"),
        ("", "report_timing_points"), ("FK", "personnel_id"), ("", "summary_date"),
    ]),
    "APPRAISAL_RECORD": (40, 560, [
        ("PK", "appraisal_id"), ("", "appraisal_type"), ("", "total_points"),
        ("", "appraisal_status"), ("", "date_created"), ("FK", "personnel_id"),
        ("", "star_rating"), ("", "compliance_points"), ("", "source_type"),
    ]),
    "TASK_TYPE": (660, 1820, [("PK", "task_type_id"), ("", "task_type")]),
    "TASK": (660, 1340, [
        ("PK", "task_id"), ("FK", "personnel_id"), ("", "start_date"), ("", "end_date"),
        ("", "time"), ("", "instruction"), ("", "title"),
        ("", "disabled"), ("FK", "task_type_id"),
    ]),
    "TASK_LOG": (660, 1060, [("PK", "tasklog_id"), ("", "submissionDate"), ("FK", "personnel_id"), ("FK", "task_id")]),
    "REPORTS": (340, 1340, [
        ("PK", "report_id"), ("", "reportDescription"), ("", "reportTitle"),
        ("", "reportType"), ("", "reportFilePath"), ("", "reportFileName"),
        ("", "reportLinkUrl"), ("FK", "task_id"),
    ]),
    "SUBMISSION_LOG": (340, 1700, [
        ("PK", "submission_log_id"), ("", "status"), ("", "dateOfSubmission"),
        ("FK", "sender_personnel_id"), ("FK", "report_id"), ("FK", "receiver_personnel_id"),
    ]),
    "COMMENT": (1000, 1720, [("PK", "comment_id"), ("FK", "personnel_id"), ("FK", "task_id"), ("", "comments"), ("", "date")]),
    "SPECIAL_TASK_EVALUATION": (1020, 1060, [
        ("PK", "special_eval_id"), ("FK", "special_task_id"), ("FK", "evaluator_id"),
        ("", "completion_quality_score"), ("", "timeliness_score"),
        ("", "initiative_score"), ("", "weighted_average"), ("", "date_submitted"),
    ]),
    "TIMING_POINTS_RECORD": (1160, 1400, [
        ("PK", "timing_record_id"), ("", "submission_time"), ("", "deadline_time"),
        ("", "timing_category"), ("", "points_earned"), ("FK", "personnel_id"), ("FK", "task_id"),
    ]),
    # ── Event proposal (normalized) ──────────────────────────────────────────
    "EVENTS": (1360, 560, [
        ("PK", "event_id"), ("FK", "created_by"), ("", "title"), ("", "nature"),
        ("", "target_date"), ("", "venue"), ("", "proposed_budget"), ("", "fund_source"),
        ("", "focal_name"), ("", "focal_role"), ("", "focal_contact"),
        ("", "rationale"), ("", "objectives"), ("", "monitoring_criteria"),
        ("", "status"), ("", "created_at"),
    ]),
    "EVENT_OUTPUT": (1660, 40, [("PK", "output_id"), ("FK", "event_id"), ("", "output_text")]),
    "EVENT_PARTICIPANT": (1660, 180, [
        ("PK", "participant_id"), ("FK", "event_id"), ("", "category"),
        ("", "male_count"), ("", "female_count"),
    ]),
    "EVENT_METHODOLOGY": (1660, 380, [
        ("PK", "methodology_id"), ("FK", "event_id"), ("", "phase_no"),
        ("", "stage"), ("", "activities"),
    ]),
    "EVENT_ACTIVITY": (1660, 580, [
        ("PK", "activity_id"), ("FK", "event_id"), ("", "activity_day"),
        ("", "activity_time"), ("", "activity_name"), ("", "speaker"),
    ]),
    "EVENT_BUDGET_ITEM": (1660, 810, [
        ("PK", "budget_item_id"), ("FK", "event_id"), ("", "item_category"),
        ("", "item_name"), ("", "quantity"), ("", "cost_per_unit"), ("", "total_cost"),
    ]),
    "EVENT_INDICATOR": (1660, 1070, [("PK", "indicator_id"), ("FK", "event_id"), ("", "label")]),
    "EVENT_SIGNATORY": (1660, 1210, [
        ("PK", "signatory_id"), ("FK", "event_id"), ("", "role"),
        ("", "signatory_name"), ("", "signatory_title"), ("", "sequence"),
    ]),
    "EVENT_COMMITTEE": (1360, 1080, [
        ("PK", "event_committee_id"), ("FK", "event_id"), ("", "committee_type"), ("", "title"),
    ]),
    "COMMITTEE_MEMBER": (1360, 1280, [
        ("PK", "member_id"), ("FK", "event_committee_id"), ("FK", "personnel_id"),
        ("", "member_name"), ("", "designation"), ("", "terms_of_reference"), ("", "output"),
    ]),
    # ── Appraisal-side event scoring (kept as-is: supervisor rubric) ──────────
    "SCHOOL_EVENT": (1080, 120, [
        ("PK", "school_event_id"), ("", "title"), ("", "description"),
        ("", "event_date"), ("", "status"), ("FK", "created_by"),
    ]),
    "EVENT_EVALUATION": (1360, 120, [
        ("PK", "evaluation_id"), ("FK", "event_id"), ("FK", "evaluator_id"),
        ("", "evaluator_name"), ("", "evaluator_role"), ("", "planning_score"),
        ("", "objectives_score"), ("", "personnel_score"), ("", "time_mgmt_score"),
        ("", "engagement_score"), ("", "resource_score"),
        ("", "feedback_comments"), ("", "date_submitted"),
    ]),
    # ── Additional implemented tables ────────────────────────────────────────
    "TASK_ATTACHMENTS": (40, 1180, [
        ("PK", "attachment_id"), ("FK", "task_id"), ("", "attachment_type"),
        ("", "name"), ("", "url"), ("", "created_at"),
    ]),
    "TASK_TEMPLATES": (40, 1430, [
        ("PK", "template_id"), ("", "title"), ("", "instructions"), ("", "start_date"),
        ("", "end_date"), ("", "due_time"), ("", "points_early"), ("", "points_ontime"),
        ("", "points_late24"), ("", "points_after24"), ("FK", "created_by"), ("", "created_at"),
    ]),
    "NOTIFICATIONS": (40, 1820, [
        ("PK", "notification_id"), ("FK", "personnel_id"), ("", "type"), ("", "title"),
        ("", "body"), ("", "ref_id"), ("", "is_read"), ("", "created_at"),
    ]),
    "SPECIAL_TASKS": (1020, 740, [
        ("PK", "special_task_id"), ("", "title"), ("", "description"),
        ("FK", "assignee_id"), ("FK", "assigned_by"), ("", "due_date"),
        ("", "status"), ("", "created_at"),
    ]),
    "ACTIVITY_EVENTS": (1660, 1420, [
        ("PK", "activity_event_id"), ("", "title"), ("", "description"),
        ("", "event_date"), ("", "status"), ("FK", "created_by"), ("", "created_at"),
    ]),
}

# (source_entity, target_entity, label)  — source has FK referencing target (many->one)
RELATIONSHIPS = [
    ("PERSONNEL_ROLE", "PERSONNEL", "identifies"),
    ("PERSONNEL_ROLE", "ROLES", "identifies"),
    ("LOAD_ASSIGNMENT", "PERSONNEL", "delegated"),
    ("LOAD_ASSIGNMENT", "SUBJECT", "contains"),
    ("LOAD_ASSIGNMENT", "GRADE_LEVEL", "associates"),
    ("DEAN_ASSIGNMENT", "PERSONNEL", "is assigned"),
    ("DEAN_ASSIGNMENT", "GRADE_LEVEL", "handled"),
    ("COORDINATOR_TYPE", "PERSONNEL", "is assigned"),
    ("PERFORMANCE_SUMMARY", "PERSONNEL", "has"),
    ("APPRAISAL_RECORD", "PERSONNEL", "has"),
    ("TASK", "PERSONNEL", "assigns"),
    ("TASK", "TASK_TYPE", "contains"),
    ("TASK_LOG", "PERSONNEL", "holds"),
    ("TASK_LOG", "TASK", "holds"),
    ("REPORTS", "TASK", "receive"),
    ("SUBMISSION_LOG", "REPORTS", "records"),
    ("SUBMISSION_LOG", "PERSONNEL", "sender"),
    ("COMMENT", "PERSONNEL", "writes"),
    ("COMMENT", "TASK", "contains"),
    ("SPECIAL_TASK_EVALUATION", "SPECIAL_TASKS", "assessed by"),
    ("SPECIAL_TASK_EVALUATION", "PERSONNEL", "evaluated by"),
    ("SPECIAL_TASKS", "PERSONNEL", "assigned to"),
    ("TASK_ATTACHMENTS", "TASK", "attached to"),
    ("TASK_TEMPLATES", "PERSONNEL", "created by"),
    ("NOTIFICATIONS", "PERSONNEL", "notifies"),
    ("ACTIVITY_EVENTS", "PERSONNEL", "creates"),
    ("TIMING_POINTS_RECORD", "TASK", "generates"),
    ("TIMING_POINTS_RECORD", "PERSONNEL", "has"),
    ("EVENTS", "PERSONNEL", "proposes"),
    ("EVENT_OUTPUT", "EVENTS", "lists"),
    ("EVENT_PARTICIPANT", "EVENTS", "attends"),
    ("EVENT_METHODOLOGY", "EVENTS", "details"),
    ("EVENT_ACTIVITY", "EVENTS", "schedules"),
    ("EVENT_BUDGET_ITEM", "EVENTS", "budgets"),
    ("EVENT_INDICATOR", "EVENTS", "measures"),
    ("EVENT_SIGNATORY", "EVENTS", "signs"),
    ("EVENT_COMMITTEE", "EVENTS", "organizes"),
    ("COMMITTEE_MEMBER", "EVENT_COMMITTEE", "composes"),
    ("COMMITTEE_MEMBER", "PERSONNEL", "serves"),
    ("SCHOOL_EVENT", "PERSONNEL", "creates"),
    ("EVENT_EVALUATION", "SCHOOL_EVENT", "evaluates"),
    ("EVENT_EVALUATION", "PERSONNEL", "submitted by"),
]

ROW_H = 20
HEAD_H = 28
COL_W = 200


def esc(s):
    return html.escape(s, quote=True)


def entity_value(name, fields):
    # Build raw HTML (real tags, U+00A0 for indent). The whole string is
    # XML-escaped by esc() when placed into the value="..." attribute, which is
    # exactly how draw.io stores html=1 labels.
    lines = [f"<b>{name}</b>"]
    for marker, fld in fields:
        tag = f"<i>{marker}</i> " if marker else "    "
        text = f"<u>{fld}</u>" if marker == "PK" else fld
        lines.append(f"{tag}{text}")
    return "<br>".join(lines)


def build():
    cells = []
    cells.append('<mxCell id="0"/>')
    cells.append('<mxCell id="1" parent="0"/>')
    ids = {}
    for i, (name, (x, y, fields)) in enumerate(ENTITIES.items(), start=2):
        cid = f"e{i}"
        ids[name] = cid
        h = HEAD_H + ROW_H * len(fields)
        style = ("rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;align=left;"
                 "spacingLeft=8;spacingTop=4;fillColor=#ffffff;strokeColor=#000000;"
                 "fontSize=11;")
        cells.append(
            f'<mxCell id="{cid}" value="{esc(entity_value(name, fields))}" style="{style}" '
            f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{COL_W}" '
            f'height="{h}" as="geometry"/></mxCell>'
        )
    for j, (src, tgt, label) in enumerate(RELATIONSHIPS, start=1):
        if src not in ids or tgt not in ids:
            continue
        eid = f"r{j}"
        style = ("edgeStyle=entityRelationEdgeStyle;fontSize=10;html=1;rounded=0;"
                 "startArrow=ERmany;startFill=0;endArrow=ERone;endFill=0;"
                 "exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
        cells.append(
            f'<mxCell id="{eid}" value="{esc(label)}" style="{style}" edge="1" '
            f'parent="1" source="{ids[src]}" target="{ids[tgt]}">'
            f'<mxGeometry relative="1" as="geometry"/></mxCell>'
        )
    body = "\n        ".join(cells)
    return (
        '<mxfile host="app.diagrams.net" type="device">\n'
        '  <diagram id="tasknet-erd" name="TaskNet ERD">\n'
        '    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" '
        'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        'pageWidth="2000" pageHeight="2200" math="0" shadow="0">\n'
        '      <root>\n'
        f'        {body}\n'
        '      </root>\n'
        '    </mxGraphModel>\n'
        '  </diagram>\n'
        '</mxfile>\n'
    )


def _box_h(fields):
    return HEAD_H + ROW_H * len(fields)


def _border_point(x, y, w, h, tx, ty):
    """Point on the rect border in the direction of (tx, ty)."""
    cx, cy = x + w / 2, y + h / 2
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sx = (w / 2) / abs(dx) if dx else float("inf")
    sy = (h / 2) / abs(dy) if dy else float("inf")
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def export_svg():
    pad = 40
    maxx = max(x + COL_W for x, y, f in ENTITIES.values())
    maxy = max(y + _box_h(f) for x, y, f in ENTITIES.values())
    W, H = maxx + pad, maxy + pad
    rects = {n: (x, y, COL_W, _box_h(f)) for n, (x, y, f) in ENTITIES.items()}
    centers = {n: (x + COL_W / 2, y + _box_h(f) / 2) for n, (x, y, f) in ENTITIES.items()}

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
         f'viewBox="0 0 {W} {H}" font-family="Helvetica,Arial,sans-serif">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>']

    # relationships (under boxes)
    for src, tgt, label in RELATIONSHIPS:
        if src not in rects or tgt not in rects:
            continue
        x1, y1 = _border_point(*rects[src], *centers[tgt])
        x2, y2 = _border_point(*rects[tgt], *centers[src])
        p.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" '
                 f'stroke="#9aa6b8" stroke-width="1"/>')
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        w = len(label) * 6 + 6
        p.append(f'<rect x="{mx - w/2:.0f}" y="{my - 7:.0f}" width="{w:.0f}" height="13" '
                 f'fill="#ffffff" opacity="0.85"/>')
        p.append(f'<text x="{mx:.0f}" y="{my + 3:.0f}" font-size="9" fill="#5a6472" '
                 f'text-anchor="middle">{esc(label)}</text>')

    # entity boxes
    for name, (x, y, fields) in ENTITIES.items():
        h = _box_h(fields)
        p.append(f'<rect x="{x}" y="{y}" width="{COL_W}" height="{h}" fill="#ffffff" '
                 f'stroke="#1a1a2e" stroke-width="1.3"/>')
        p.append(f'<rect x="{x}" y="{y}" width="{COL_W}" height="{HEAD_H}" fill="#dce6f5" '
                 f'stroke="#1a1a2e" stroke-width="1.3"/>')
        p.append(f'<text x="{x + COL_W/2:.0f}" y="{y + 19:.0f}" font-size="12" '
                 f'font-weight="bold" text-anchor="middle">{esc(name)}</text>')
        ty = y + HEAD_H
        for marker, fld in fields:
            ty += ROW_H
            if marker:
                p.append(f'<text x="{x + 8}" y="{ty - 6:.0f}" font-size="9" '
                         f'font-style="italic" fill="#8a93a3">{marker}</text>')
            deco = ' text-decoration="underline"' if marker == "PK" else ""
            p.append(f'<text x="{x + 34}" y="{ty - 6:.0f}" font-size="10"{deco}>{esc(fld)}</text>')
    p.append("</svg>")
    return "\n".join(p)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    drawio_out = os.path.join(here, "tasknet_erd.drawio")
    with open(drawio_out, "w", encoding="utf-8") as f:
        f.write(build())
    svg_out = os.path.join(here, "tasknet_erd.svg")
    with open(svg_out, "w", encoding="utf-8") as f:
        f.write(export_svg())
    print("wrote", drawio_out)
    print("wrote", svg_out, "—", len(ENTITIES), "entities,", len(RELATIONSHIPS), "relationships")
