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


# ── Page 2: sample relational data model with inputs ─────────────────────────

def html_table(name, header, rows, note=""):
    th = "".join(f'<th style="border:1px solid #999;padding:2px 6px;background:#eeeeee">{html.escape(h)}</th>'
                 for h in header)
    trs = "".join(
        "<tr>" + "".join(f'<td style="border:1px solid #999;padding:2px 6px">{html.escape(str(c))}</td>'
                         for c in r) + "</tr>"
        for r in rows)
    title = f"<b>{html.escape(name)}</b>" + (f" <i style='color:#b45309'>{html.escape(note)}</i>" if note else "")
    return (f'{title}<table style="border-collapse:collapse;font-size:10px;margin-top:4px">'
            f"<tr>{th}</tr>{trs}</table>")


def input_box(title, who, fields):
    lines = "".join(f"<b>{html.escape(k)}:</b> {html.escape(v)}<br>" for k, v in fields)
    return (f"<b>{html.escape(title)}</b><br><i>{html.escape(who)}</i><br>"
            f"<span style='color:#1d4ed8'>INPUT</span><br>{lines}")


STEPS = [
    ("1. Create the account", "Principal · Personnel → Add User", [
        ("Username", "teacher2"), ("Password", "••••••••"),
        ("Name", "Juan D. Santos"), ("Role", "Teacher"), ("Grade level", "Grade 1"),
    ], [
        ("users", ["id", "username", "password_hash", "first_name", "middle_name", "last_name",
                   "role", "grade_level_id", "number_of_children", "is_active",
                   "full_name (computed)"],
         [[9, "teacher2", "$2b$12$…", "Juan", "D.", "Santos", "teacher", 1, 0, 1,
           "Juan D. Santos"]], ""),
        ("user_held_roles (view)", ["user_id", "role"], [[9, "teacher"]],
         "(no user_roles row: teacher is Juan's primary role)"),
        ("audit_log", ["id", "created_at", "actor_id", "actor_role", "action", "entity_type",
                       "entity_id", "summary"],
         [[1, "2026-10-09T01:02:11Z", "2 (Liza Ramos)", "principal", "account.create", "user", 9,
           "Created account teacher2 as teacher"]], "(example)"),
        ("audit_log_changes", ["id", "audit_id", "field_name", "old_value", "new_value"],
         [[1, 1, "role", "null", '"teacher"'], [2, 1, "grade_level", "null", '"Grade 1"']],
         "(example)"),
    ]),
    ("2. Assign the teaching load", "Principal · Personnel → Edit", [
        ("Subject-grade", "English · Grade 1"), ("Subject-grade", "Filipino · Grade 1"),
    ], [
        ("user_subjects", ["id", "user_id", "subject_id", "grade_level_id"],
         [[3, 9, "3 (English)", 1], [4, 9, "4 (Filipino)", 1]], ""),
    ]),
    ("3. Education and skills", "Juan · My Profile → Edit (dropdowns)", [
        ("Highest attainment", "With Master's Units"), ("Undergraduate", "BSEd"),
        ("Specialization", "Science"),
        ("Skills", "Sports Coaching, Disaster Preparedness, ICT Troubleshooting"),
    ], [
        ("education_background", ["id", "user_id", "highest_attainment", "undergraduate_degree",
                                  "specialization", "postgraduate_focus"],
         [[3, 9, "With Master's Units", "BSEd", "Science", "null"]], ""),
        ("user_skills", ["id", "user_id", "skill_id", "→ skill (category)"],
         [[4, 9, 4, "Sports Coaching (Event Operations & Logistics)"],
          [5, 9, 5, "Disaster Preparedness (Administrative Governance & Compliance)"],
          [6, 9, 6, "ICT Troubleshooting (ICT & Digital Operations)"]], ""),
    ]),
    ("4. Upload a certificate", "Juan · My Profile → Upload certificate", [
        ("File", "first_aid.png (photo)"),
        ("Text read (OCR)", "PHILIPPINE RED CROSS · JUAN D. SANTOS · STANDARD FIRST AID · "
                            "March 15, 2025 · No. PRC-SFA-2025-00123"),
        ("Confirmed as", "Standard First Aid"),
    ], [
        ("certificate_files", ["id", "user_id", "certification_id", "mime", "detected_title",
                               "match_confidence", "certificate_no", "date_issued",
                               "expiry_date", "status"],
         [[21, 9, "2 (Standard First Aid)", "image/png", "Standard First Aid", "1.00",
           "PRC-SFA-2025-00123", "2025-03-15", "null", "submitted"]], "(example)"),
        ("certificate_checks", ["id", "certificate_file_id", "check_key", "status", "detail"],
         [[101, 21, "issuer", "pass", "Issued by Philippine Red Cross"],
          [102, 21, "name", "pass", "Issued to the profile owner"],
          [103, 21, "dates", "pass", "Dated 2025-03-15"],
          [104, 21, "number", "pass", "No. PRC-SFA-2025-00123"],
          [105, 21, "duplicate", "pass", "No one else uploaded this file"]],
         "(example; overall rating 'high' is computed from these rows)"),
    ]),
    ("5. Verify the certificate", "Registrar · Personnel → View Details → Review", [
        ("Decision", "Verify"), ("Note", "Checked against the original"),
    ], [
        ("certificate_files (updated)", ["id", "status", "review_note", "reviewed_by", "reviewed_at"],
         [[21, "verified", "Checked against the original", "5 (registrar)", "2026-10-09 08:12:40"]],
         "(example)"),
        ("audit_log", ["id", "created_at", "actor_id", "actor_role", "action", "entity_type",
                       "entity_id", "summary"],
         [[4, "2026-10-09T08:12:40Z", "5 (Ana Cruz)", "registrar", "certificate.verified",
           "certificate", 21, "Verified certificate Standard First Aid"]], "(example)"),
        ("audit_log_changes", ["id", "audit_id", "field_name", "old_value", "new_value"],
         [[7, 4, "status", '"submitted"', '"verified"'],
          [8, 4, "note", "null", '"Checked against the original"']], "(example)"),
    ]),
]


def table_height(rows):
    return 34 + 20 * (len(rows) + 1)


def build_sample_page():
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    cells.append(text("s-title", "<b style='font-size:18px'>Sample relational data model — "
                      "inputs and the rows they create</b><br>"
                      "Steps 1–4 are Juan's actual rows in the seeded database; "
                      "rows marked (example) illustrate what the step writes.",
                      40, -50, 1100, 46))
    y = 20
    n = 0
    for title, who, fields, tables in STEPS:
        heights = [table_height(t[2]) for t in tables]
        row_h = max(150, sum(heights) + 12 * (len(tables) - 1))
        n += 1
        cells.append(text(f"in{n}", input_box(title, who, fields), 40, y, 300, row_h,
                          "rounded=1;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=11;"
                          "fillColor=#eff6ff;strokeColor=#2563eb;dashed=1;spacingLeft=8;spacingTop=6;"))
        ty = y
        prev = f"in{n}"
        for k, ((name, header, rows, note), th) in enumerate(zip(tables, heights)):
            cid = f"tb{n}_{k}"
            cells.append(text(cid, html_table(name, header, rows, note), 400, ty, 1150, th,
                              "rounded=0;html=1;align=left;verticalAlign=top;whiteSpace=wrap;"
                              "fontSize=11;fillColor=#ffffff;strokeColor=#cccccc;spacingLeft=6;"
                              "spacingTop=4;overflow=hidden;"))
            cells.append(
                f'<mxCell id="a{n}_{k}" value="writes" style="edgeStyle=orthogonalEdgeStyle;'
                f'html=1;endArrow=block;fontSize=9;strokeColor=#2563eb;" edge="1" parent="1" '
                f'source="in{n}" target="{cid}"><mxGeometry relative="1" as="geometry"/></mxCell>')
            ty += th + 12
        y += row_h + 40
    return diagram("personnel-sample", "Sample Data (inputs → rows)", cells, w=1650, h=y + 60)


def build():
    return ('<mxfile host="app.diagrams.net" type="device">\n'
            + build_erd_page() + build_sample_page() + '</mxfile>\n')


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "personnel_profiling_erd.drawio"), "w", encoding="utf-8") as f:
        f.write(build())
    print("wrote personnel_profiling_erd.drawio (ERD + sample data pages)")
