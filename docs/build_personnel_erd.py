"""Generates personnel_profiling_erd.drawio — the personnel profiling ERD
(page 1, crow's-foot notation, matches backend/database.py) and a sample
relational data model tracing one teacher's inputs into rows (page 2).

Run: python docs/build_personnel_erd.py
"""
import html
import os

ROW_H = 16
HEAD_H = 26
SEP = 10
W = 250

# name -> (x, y, [attributes])
TABLES = {
    "grade_levels": (370, 800, [
        "id (PK)", "grade_level (UK)",
    ]),
    "roles": (40, 330, [
        "id (PK)", "roles (UK): admin | principal | coordinator | dean | teacher | registrar",
    ]),
    "subjects": (40, 520, [
        "id (PK)", "subject_name (UK)",
    ]),
    "user_roles": (370, 330, [
        "id (PK)", "user_id (FK users)", "role_id (FK roles)", "UNIQUE(user_id, role_id)",
        "additional roles only (primary is users.role)",
    ]),
    "user_subjects": (370, 480, [
        "id (PK)", "user_id (FK users)", "subject_id (FK subjects)",
        "grade_level_id (FK grade_levels)", "UNIQUE(user_id, subject_id, grade_level_id)",
    ]),
    "dean_assignment": (370, 650, [
        "id (PK)", "user_id (FK users, UK)", "grade_level_id (FK grade_levels)",
    ]),
    "users": (700, 330, [
        "id (PK)", "username (UK)", "password_hash (bcrypt)",
        "first_name", "middle_name", "last_name", "suffix",
        "role (FK roles.roles): primary role", "grade_level_id (FK grade_levels): advisory grade",
        "avatar_url",
        "email", "phone_number", "number_of_children (default 0)",
        "has_elderly_or_infant_care (0/1)", "overtime_opt_in (0/1)",
        "date_of_appointment (DATE)", "birthdate (DATE)", "address", "is_active (0/1)", "created_at",
        "full_name = first + middle + last + suffix (computed, not stored)",
    ]),
    "coordinator_type": (370, 180, [
        "id (PK)", "user_id (FK users, UK)", "coordinator_type",
    ]),
    "audit_log": (700, 740, [
        "id (PK)", "created_at (UTC)", "actor_id (FK users)", "actor_role",
        "action", "entity_type", "entity_id", "summary", "ip_address",
        "append-only: UPDATE/DELETE blocked by triggers",
    ]),
    "audit_log_changes": (700, 1010, [
        "id (PK)", "audit_id (FK audit_log)", "field_name", "old_value", "new_value",
        "UNIQUE(audit_id, field_name)",
    ]),
    "education_background": (700, 40, [
        "id (PK)", "user_id (FK users, UK)", "highest_attainment", "undergraduate_degree",
        "specialization", "postgraduate_focus", "updated_at",
    ]),
    "user_skills": (1030, 200, [
        "id (PK)", "user_id (FK users)", "skill_id (FK skills)", "UNIQUE(user_id, skill_id)",
    ]),
    "certificate_files": (1030, 470, [
        "id (PK)", "user_id (FK users)", "certification_id (FK certifications)",
        "file_path (private folder)", "original_name", "mime", "sha256 (duplicate check)",
        "extracted_text (PDF text / OCR)", "detected_title", "match_confidence",
        "certificate_no", "date_issued", "expiry_date",
        "status: pending | submitted | verified | rejected",
        "(holds certification = status submitted or verified)",
        "review_note", "reviewed_by (FK users)", "reviewed_at", "created_at",
    ]),
    "certificate_checks": (1360, 740, [
        "id (PK)", "certificate_file_id (FK certificate_files)", "check_key",
        "status: pass | warn | fail | info", "label", "detail",
        "UNIQUE(certificate_file_id, check_key)",
    ]),
    "skill_categories": (1360, 20, [
        "id (PK)", "category_name (UK)", "description",
    ]),
    "skill_category_keywords": (1690, 20, [
        "id (PK)", "category_id (FK skill_categories)", "keyword",
        "UNIQUE(category_id, keyword)",
    ]),
    "skill_keywords": (1690, 170, [
        "id (PK)", "skill_id (FK skills)", "keyword (task it suits)",
        "UNIQUE(skill_id, keyword)",
    ]),
    "certification_keywords": (1360, 580, [
        "id (PK)", "certification_id (FK certifications)", "keyword (task it suits)",
        "UNIQUE(certification_id, keyword)",
    ]),
    "skills": (1360, 180, [
        "id (PK)", "skill_name (UK)", "category_id (FK skill_categories)",
    ]),
    "certifications": (1360, 420, [
        "id (PK)", "cert_name (UK)", "category_id (FK certification_categories)",
        "issuer_id (FK certification_issuers)",
    ]),
    "certification_categories": (1690, 330, [
        "id (PK)", "category_name (UK)",
    ]),
    "certification_category_keywords": (2020, 330, [
        "id (PK)", "category_id (FK certification_categories)", "keyword",
        "UNIQUE(category_id, keyword)",
    ]),
    "certification_issuers": (1690, 480, [
        "id (PK)", "issuer_name (UK)", "acronym",
    ]),
}

GROUP_COLORS = {  # fill per table group
    "account": "#dae8fc", "delegation": "#e1d5e7", "education": "#fff2cc",
    "skills": "#d5e8d4", "certs": "#ffe6cc", "audit": "#f5f5f5",
}
GROUP = {
    "users": "account", "roles": "account", "user_roles": "account",
    "grade_levels": "delegation", "subjects": "delegation", "user_subjects": "delegation",
    "dean_assignment": "delegation", "coordinator_type": "delegation",
    "education_background": "education",
    "skill_categories": "skills", "skill_category_keywords": "skills", "skills": "skills",
    "user_skills": "skills", "skill_keywords": "skills", "certification_keywords": "certs",
    "certification_categories": "certs", "certification_category_keywords": "certs",
    "certification_issuers": "certs", "certifications": "certs",
    "certificate_files": "certs", "certificate_checks": "certs",
    "audit_log": "audit", "audit_log_changes": "audit",
}

# (parent, child, cardinality, label). Cardinality:
#   "1N" exactly one parent -> zero or many children
#   "11" exactly one parent -> zero or one child
#   "oN" optional parent (nullable FK) -> zero or many children
RELATIONS = [
    ("grade_levels", "users", "oN", "home grade"),
    ("roles", "users", "1N", "primary role"),
    ("users", "user_roles", "1N", "also holds"),
    ("roles", "user_roles", "1N", "granted as"),
    ("users", "user_subjects", "1N", "teaches"),
    ("subjects", "user_subjects", "1N", "taught as"),
    ("grade_levels", "user_subjects", "oN", "for grade"),
    ("users", "coordinator_type", "11", "coordinates as"),
    ("users", "dean_assignment", "11", "is dean of"),
    ("grade_levels", "dean_assignment", "1N", "covered by"),
    ("users", "education_background", "11", "has"),
    ("skill_categories", "skills", "oN", "groups"),
    ("skill_categories", "skill_category_keywords", "1N", "matched by"),
    ("skills", "skill_keywords", "1N", "suits"),
    ("certifications", "certification_keywords", "1N", "suits"),
    ("users", "user_skills", "1N", "has"),
    ("skills", "user_skills", "1N", "held by"),
    ("certification_categories", "certifications", "oN", "groups"),
    ("certification_categories", "certification_category_keywords", "1N", "matched by"),
    ("certification_issuers", "certifications", "oN", "issues"),
    ("users", "certificate_files", "1N", "uploads"),
    ("certifications", "certificate_files", "oN", "identified as"),
    ("users", "certificate_files", "oN", "reviews (reviewed_by)"),
    ("certificate_files", "certificate_checks", "1N", "checked by"),
    ("users", "audit_log", "oN", "acts in (actor_id)"),
    ("audit_log", "audit_log_changes", "1N", "records"),
]

PORTS = {
    ('grade_levels', 'users', 'home grade'): (1, 0.5, 0, 0.97),
    ('users', 'user_roles', 'also holds'): (0, 0.2, 1, 0.5),
    ('roles', 'users', 'primary role'): (0.5, 0, 0.12, 0),
    ('roles', 'user_roles', 'granted as'): (1, 0.5, 0, 0.5),
    ('users', 'user_subjects', 'teaches'): (0, 0.5, 1, 0.5),
    ('subjects', 'user_subjects', 'taught as'): (1, 0.5, 0, 0.3),
    ('grade_levels', 'user_subjects', 'for grade'): (0, 0.5, 0, 0.8),
    ('users', 'coordinator_type', 'coordinates as'): (0, 0.05, 1, 0.5),
    ('users', 'dean_assignment', 'is dean of'): (0, 0.8, 1, 0.5),
    ('grade_levels', 'dean_assignment', 'covered by'): (0.5, 0, 0.5, 1),
    ('users', 'education_background', 'has'): (0.5, 0, 0.5, 1),
    ('skill_categories', 'skills', 'groups'): (0.5, 1, 0.5, 0),
    ('skill_categories', 'skill_category_keywords', 'matched by'): (1, 0.5, 0, 0.5),
    ('users', 'user_skills', 'has'): (1, 0.1, 0, 0.5),
    ('skills', 'skill_keywords', 'suits'): (1, 0.5, 0, 0.5),
    ('certifications', 'certification_keywords', 'suits'): (0.5, 1, 0.5, 0),
    ('skills', 'user_skills', 'held by'): (0, 0.5, 1, 0.5),
    ('certification_categories', 'certifications', 'groups'): (0, 0.5, 1, 0.3),
    ('certification_categories', 'certification_category_keywords', 'matched by'): (1, 0.5, 0, 0.5),
    ('certification_issuers', 'certifications', 'issues'): (0, 0.5, 1, 0.8),
    ('users', 'certificate_files', 'uploads'): (1, 0.45, 0, 0.3),
    ('certifications', 'certificate_files', 'identified as'): (0, 0.5, 1, 0.15),
    ('users', 'certificate_files', 'reviews (reviewed_by)'): (1, 0.9, 0, 0.6),
    ('certificate_files', 'certificate_checks', 'checked by'): (1, 0.8, 0, 0.5),
    ('users', 'audit_log', 'acts in (actor_id)'): (0.5, 1, 0.5, 0),
    ('audit_log', 'audit_log_changes', 'records'): (0.5, 1, 0.5, 0),
}

ARROWS = {
    "1N": ("ERmandOne", "ERzeroToMany", ""),
    "11": ("ERmandOne", "ERzeroToOne", ""),
    "oN": ("ERzeroToOne", "ERzeroToMany", ""),
}


def esc(s):
    return html.escape(s, quote=True)


def box_h(attrs):
    return HEAD_H + len(attrs) * ROW_H + 2 * SEP + 6


def table_value(name, attrs):
    rows = []
    for a in attrs:
        if "(PK)" in a:
            rows.append(f"<u><b>{html.escape(a)}</b></u>")
        elif "(FK" in a:
            rows.append(f"<i>{html.escape(a)}</i>")
        else:
            rows.append(html.escape(a))
    raw = (f'<div style="text-align:center"><b>{name}</b></div><hr size="1">'
           + "<br>".join(rows))
    return esc(raw)


def diagram(page_id, name, cells, w=1700, h=1100):
    body = "\n        ".join(cells)
    return (
        f'  <diagram id="{page_id}" name="{esc(name)}">\n'
        f'    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
        f'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{w}" '
        f'pageHeight="{h}" math="0" shadow="0">\n'
        '      <root>\n'
        f'        {body}\n'
        '      </root>\n'
        '    </mxGraphModel>\n'
        '  </diagram>\n'
    )


def text(cid, value, x, y, w, h, style="text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=11;"):
    return (f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


def build_erd_page():
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    ids = {}
    for i, (name, (x, y, attrs)) in enumerate(TABLES.items(), start=2):
        tid = f"t{i}"
        ids[name] = tid
        fill = GROUP_COLORS[GROUP[name]]
        style = ("rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;align=left;"
                 f"spacingLeft=8;spacingTop=4;fillColor={fill};strokeColor=#333333;fontSize=10;")
        cells.append(
            f'<mxCell id="{tid}" value="{table_value(name, attrs)}" style="{style}" '
            f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{W}" '
            f'height="{box_h(attrs)}" as="geometry"/></mxCell>')

    for n, (parent, child, card, label) in enumerate(RELATIONS, start=1):
        start, end, extra = ARROWS[card]
        ex, ey, nx, ny = PORTS[(parent, child, label)]
        extra += f"exitX={ex};exitY={ey};exitDx=0;exitDy=0;entryX={nx};entryY={ny};entryDx=0;entryDy=0;"
        style = (f"edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;startArrow={start};"
                 f"endArrow={end};startFill=0;endFill=0;fontSize=9;{extra}")
        cells.append(
            f'<mxCell id="r{n}" value="{esc(label)}" style="{style}" edge="1" parent="1" '
            f'source="{ids[parent]}" target="{ids[child]}"><mxGeometry relative="1" as="geometry"/></mxCell>')

    cells.append(text("title", "<b style='font-size:18px'>TaskNet — Personnel Profiling ERD</b><br>"
                      "Third Normal Form · matches backend/database.py",
                      40, -40, 700, 40))
    legend = ("<b>Legend</b><br>"
              "<u><b>id (PK)</b></u> primary key · <i>(FK table)</i> foreign key · (UK) unique<br>"
              "Crow's foot: |— exactly one · o— zero or one · &lt; many<br>"
              "In 3NF: no lists or JSON in a column (keywords, checks and audit changes are rows), "
              "no stored derived values (full_name is computed)<br>"
              "View <b>user_held_roles</b> = users.role ∪ user_roles: every role a person holds<br>"
              "Colors: blue account &amp; roles · purple delegation · yellow education · "
              "green skills · orange certifications · grey audit")
    cells.append(text("legend", legend, 1690, 680, 600, 120,
                      "rounded=1;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=11;"
                      "fillColor=#ffffff;strokeColor=#999999;spacingLeft=8;spacingTop=6;"))
    return diagram("personnel-erd", "Personnel Profiling ERD (3NF)", cells, w=2320, h=1260)


# ── Page 2: sample relational data (black & white tables, real rows) ─────────
# Native draw.io tables (editable cells). Arrows run from the referenced table
# (the "one" side) to the table holding the foreign key.

ROW_PX = 24
CHAR_PX = 6.6
CELL_PAD = 18

REL_TABLES = {
    # name: (x, y, [columns], [rows])
    "roles": (80, 60, ["id", "roles"],
              [[1, "admin"], [2, "principal"], [3, "coordinator"], [4, "dean"],
               [5, "teacher"], [6, "registrar"]]),
    "grade_levels": (300, 60, ["id", "grade_level"],
                     [[1, "Grade 1"], [2, "Grade 2"], [3, "Grade 3"]]),
    "subjects": (620, 60, ["id", "subject_name"],
                 [[3, "English"], [4, "Filipino"], [7, "Mathematics"], [9, "Science"]]),
    "skill_categories": (1000, 60, ["id", "category_name"],
                         [[1, "Instructional & Curriculum Design"], [2, "ICT & Digital Operations"],
                          [3, "Event Operations & Logistics"],
                          [4, "Administrative Governance & Compliance"]]),
    "certification_issuers": (1460, 60, ["id", "issuer_name", "acronym"],
                              [[1, "Professional Regulation Commission", "PRC"],
                               [3, "National Educators Academy of the Philippines", "NEAP"],
                               [5, "Philippine Red Cross", "NULL"]]),
    "users": (80, 330, ["id", "username", "first_name", "last_name", "role", "grade_level_id"],
              [[2, "principal", "Liza", "Ramos", "principal", "NULL"],
               [6, "dean1", "Maria", "Santos", "dean", 1],
               [8, "teacher1", "Mark", "Fuentes", "teacher", 1],
               [9, "teacher2", "Juan", "Santos", "teacher", 1]]),
    "skills": (1000, 330, ["id", "skill_name", "category_id"],
               [[1, "Event Hosting", 3], [2, "Photography", 2], [3, "Layout Design", 2],
                [4, "Sports Coaching", 3], [5, "Disaster Preparedness", 4],
                [6, "ICT Troubleshooting", 2]]),
    "certifications": (1460, 330, ["id", "cert_name", "issuer_id"],
                       [[2, "Standard First Aid", 5], [3, "Basic Life Support", 5],
                        [4, "Licensed Professional Teacher", 1],
                        [49, "Comprehensive Sexuality Education (CSE) Core Trainer", 3]]),
    "user_roles": (80, 640, ["id", "user_id", "role_id"], [[11, 6, 5]]),
    "user_subjects": (620, 640, ["id", "user_id", "subject_id", "grade_level_id"],
                      [[1, 8, 7, 1], [2, 8, 9, 1], [419, 9, 3, 1], [420, 9, 4, 1]]),
    "education_background": (80, 880, ["id", "user_id", "highest_attainment", "specialization"],
                             [[3, 9, "With Master's Units", "Science"],
                              [5, 8, "Doctoral Degree (EdD/PhD)", "Science"]]),
    "user_skills": (960, 640, ["id", "user_id", "skill_id"],
                    [[4, 9, 4], [5, 9, 5], [6, 9, 6], [21, 8, 1], [22, 8, 2], [23, 8, 3]]),
    "skill_keywords": (1180, 640, ["id", "skill_id", "keyword"],
                       [[10, 2, "photo"], [11, 2, "event coverage"], [12, 2, "camera"],
                        [15, 2, "photo documentation"]]),
    "certificate_files": (1460, 640, ["id", "user_id", "certification_id", "status",
                                      "date_issued"],
                          [[13, 8, 49, "submitted", "2026-08-01"]]),
    "certificate_checks": (1460, 880, ["id", "certificate_file_id", "check_key", "status"],
                           [[17, 13, "readable", "pass"], [18, 13, "is_certificate", "pass"],
                            [19, 13, "issuer", "pass"], [20, 13, "title", "warn"],
                            [21, 13, "name", "warn"]]),
    "audit_log": (560, 880, ["id", "actor_id", "action", "entity_type", "entity_id"],
                  [[1, 2, "personnel.update", "user", 6], [2, 5, "account.deactivate", "user", 9],
                   [3, 5, "account.reactivate", "user", 9]]),
    "audit_log_changes": (560, 1100, ["id", "audit_id", "field_name", "old_value", "new_value"],
                          [[1, 1, "dean_grade_level", "null", '"Grade 3"'],
                           [2, 2, "active", "true", "false"],
                           [3, 3, "active", "false", "true"]]),
}

# (referenced, referencing, exit (x,y), entry (x,y), waypoints) - every
# arrow has its own lane so none crosses a table.
REL_LINKS = [
    ("roles", "users", (0.5, 1), (0.17, 0), []),
    ("grade_levels", "users", (0.5, 1), (0.62, 0), []),
    ("roles", "user_roles", (0, 0.5), (0, 0.5), [("V", 50)]),
    ("users", "user_roles", (0.12, 1), (0.35, 0), []),
    ("grade_levels", "user_subjects", (1, 0.5), (0, 0.5), [("V", 585)]),
    ("subjects", "user_subjects", (0.5, 1), (0.25, 0), []),
    ("users", "user_subjects", (0.8, 1), (0.6, 0), [("H", 530)]),
    ("users", "education_background", (0.62, 1), (0.7, 0), []),
    ("users", "user_skills", (0.88, 1), (0.3, 0), [("H", 555)]),
    ("skills", "user_skills", (0.2, 1), (0.75, 0), [("H", 605)]),
    ("skill_categories", "skills", (0.5, 1), (0.5, 0), []),
    ("skills", "skill_keywords", (0.8, 1), (0.5, 0), [("H", 605)]),
    ("certification_issuers", "certifications", (0.5, 1), (0.5, 0), []),
    ("users", "certificate_files", (0.95, 1), (0.2, 0), [("H", 580)]),
    ("certifications", "certificate_files", (0.6, 1), (0.6, 0), []),
    ("certificate_files", "certificate_checks", (0.5, 1), (0.5, 0), []),
    ("users", "audit_log", (0.99, 1), (0.2, 0), [("H", 850)]),
    ("audit_log", "audit_log_changes", (0.5, 1), (0.5, 0), []),
]

BW = "strokeColor=#000000;fontColor=#000000;"


def _col_widths(cols, rows):
    return [int(max(len(str(v)) for v in [c] + [r[i] for r in rows]) * CHAR_PX + CELL_PAD)
            for i, c in enumerate(cols)]


def build_sample_page():
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    cells.append(text("s-title", "<b style='font-size:18px'>Sample relational data</b><br>"
                      "Rows from the TaskNet database; arrows point from the referenced table "
                      "to the table holding the foreign key.",
                      80, -10, 1200, 44, "text;html=1;align=left;verticalAlign=top;"
                      "whiteSpace=wrap;fontSize=11;strokeColor=none;fillColor=none;fontColor=#000000;"))
    ids, geo = {}, {}
    for t, (x, y, cols, rows) in REL_TABLES.items():
        widths = _col_widths(cols, rows)
        w, h = sum(widths), ROW_PX * (len(rows) + 1)
        tid = f"rt_{t}"
        ids[t] = tid
        geo[t] = (x, y, w, h)
        cells.append(text(f"{tid}_name", f"<b>{html.escape(t)}</b>", x, y - 22, w, 20,
                          "text;html=1;align=left;verticalAlign=bottom;fontSize=12;strokeColor=none;"
                          "fillColor=none;fontColor=#000000;"))
        cells.append(
            f'<mxCell id="{tid}" value="" style="shape=table;startSize=0;container=1;collapsible=0;'
            f'childLayout=tableLayout;fontSize=11;fillColor=#FFFFFF;{BW}strokeWidth=1;" '
            f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" '
            f'as="geometry"/></mxCell>')
        for ri, row in enumerate([cols] + rows):
            rid = f"{tid}_r{ri}"
            cells.append(
                f'<mxCell id="{rid}" value="" style="shape=tableRow;horizontal=0;startSize=0;'
                f'swimlaneHead=0;swimlaneBody=0;strokeColor=inherit;top=0;left=0;bottom=0;right=0;'
                f'collapsible=0;dropTarget=0;fillColor=none;points=[[0,0.5],[1,0.5]];'
                f'portConstraint=eastwest;fontSize=11;" vertex="1" parent="{tid}">'
                f'<mxGeometry y="{ri * ROW_PX}" width="{w}" height="{ROW_PX}" as="geometry"/></mxCell>')
            cx = 0
            for ci, (val, cw) in enumerate(zip(row, widths)):
                bold = "fontStyle=1;" if ri == 0 else ""
                cells.append(
                    f'<mxCell id="{rid}_c{ci}" value="{esc(str(val))}" '
                    f'style="shape=partialRectangle;html=1;whiteSpace=wrap;connectable=0;'
                    f'strokeColor=inherit;overflow=hidden;fillColor=none;top=0;left=0;bottom=0;'
                    f'right=0;pointerEvents=1;fontSize=11;align=center;{bold}{BW}" vertex="1" '
                    f'parent="{rid}"><mxGeometry x="{cx}" width="{cw}" height="{ROW_PX}" '
                    f'as="geometry"><mxRectangle width="{cw}" height="{ROW_PX}" '
                    f'as="alternateBounds"/></mxGeometry></mxCell>')
                cx += cw
    for n, (parent, child, (ex, ey), (nx, ny), lanes) in enumerate(REL_LINKS, start=1):
        px, py, pw, ph = geo[parent]
        cx, cy, cw, ch = geo[child]
        sx, sy = px + ex * pw, py + ey * ph      # where the arrow leaves
        tx, ty = cx + nx * cw, cy + ny * ch      # where it arrives
        pts = []
        for kind, v in lanes:
            if kind == "H":    # run horizontally at y=v
                pts += [(sx, v), (tx, v)]
            else:              # "V": run vertically at x=v
                pts += [(v, sy), (v, ty)]
        points = "".join(f'<mxPoint x="{x:.0f}" y="{y:.0f}"/>' for x, y in pts)
        cells.append(
            f'<mxCell id="rl{n}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;'
            f'endArrow=block;endFill=1;strokeWidth=1.2;exitX={ex};exitY={ey};exitDx=0;exitDy=0;'
            f'entryX={nx};entryY={ny};entryDx=0;entryDy=0;{BW}" edge="1" parent="1" '
            f'source="{ids[parent]}" target="{ids[child]}"><mxGeometry relative="1" as="geometry">'
            + (f'<Array as="points">{points}</Array>' if points else '')
            + '</mxGeometry></mxCell>')
    return diagram("personnel-sample", "Sample Relational Data", cells, w=1900, h=1300)


def build():
    return ('<mxfile host="app.diagrams.net" type="device">\n'
            + build_erd_page() + build_sample_page() + '</mxfile>\n')


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "personnel_profiling_erd.drawio"), "w", encoding="utf-8") as f:
        f.write(build())
    print("wrote personnel_profiling_erd.drawio (ERD + sample data pages)")
