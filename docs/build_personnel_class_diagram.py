"""Generates personnel_class_diagram.drawio — UML class diagram of Personnel
Management as the system is now: personnel profiling (education, skills,
certificates with pre-validation), roles and load assignments, life-context
fields, and the audit trail. Native draw.io UML class shapes (name /
attributes / methods), black and white.

Run: python docs/build_personnel_class_diagram.py
"""
import html
import os

LINE_H = 14     # px per attribute / method line
HEAD_H = 26

# name -> (x, y, width, [attributes], [methods])
CLASSES = {
    "Personnel": (640, 40, 290, [
        "-personnel_id: int", "-username: string", "-password: string",
        "-firstName: string", "-middleName: string", "-lastName: string",
        "-suffix: string", "/fullName: string", "-email: string",
        "-contactNumber: string", "-birthdate: date", "-address: string",
        "-role: string", "-grade_level_id: int", "-numberOfChildren: int",
        "-hasElderlyOrInfantCare: bool", "-overtimeOptIn: bool",
        "-date_of_appointment: date", "-isActive: bool",
    ], [
        "+authenticateUser()", "+getPersonalInformation()",
        "+updatePersonalInformation()", "+updateSkills()", "+uploadCertificate()",
        "+getHeldRoles()",
    ]),
    "Role": (330, 40, 220, [
        "-role_id: int", "-role_name: string",
    ], [
        "+getRoles()",
    ]),
    "User Role": (330, 190, 220, [
        "-user_role_id: int", "-personnel_id: int", "-role_id: int",
    ], [
        "+addRole()", "+removeRole()",
    ]),
    "Education Background": (330, 360, 250, [
        "-education_id: int", "-personnel_id: int", "-highestAttainment: string",
        "-undergraduateDegree: string", "-specialization: string",
        "-postgraduateFocus: string", "-updatedAt: datetime",
    ], [
        "+getEducation()", "+updateEducation()",
    ]),
    "Audit Log": (40, 40, 240, [
        "-audit_id: int", "-createdAt: datetime", "-actor_id: int", "-actorRole: string",
        "-action: string", "-entityType: string", "-entity_id: int", "-summary: string",
        "-ipAddress: string",
    ], [
        "+recordChange()", "+getAuditLog()",
    ]),
    "Audit Log Change": (40, 340, 240, [
        "-change_id: int", "-audit_id: int", "-fieldName: string", "-oldValue: string",
        "-newValue: string",
    ], [
        "+getChanges()",
    ]),
    "Grade Level": (1010, 40, 220, [
        "-grade_level_id: int", "-grade_level: string",
    ], [
        "+getGradeLevel()", "+addGradeLevel()",
    ]),
    "Load Assignment": (1010, 190, 220, [
        "-load_assign_id: int", "-personnel_id: int", "-subject_id: int",
        "-grade_level_id: int",
    ], [
        "+getLoadAssignment()", "+assignLoadAssignment()", "+updateLoadAssignment()",
    ]),
    "Subject": (1300, 190, 200, [
        "-subject_id: int", "-subject_name: string",
    ], [
        "+getSubject()",
    ]),
    "Personnel Skill": (1010, 420, 220, [
        "-personnel_skill_id: int", "-personnel_id: int", "-skill_id: int",
    ], [
        "+addSkill()", "+removeSkill()",
    ]),
    "Skill": (1300, 420, 220, [
        "-skill_id: int", "-skill_name: string", "-category_id: int",
    ], [
        "+getSkills()",
    ]),
    "Skill Keyword": (1300, 600, 220, [
        "-skill_keyword_id: int", "-skill_id: int", "-keyword: string",
    ], [
        "+getKeywords()",
    ]),
    "Skill Category": (1590, 420, 230, [
        "-category_id: int", "-category_name: string", "-description: string",
    ], [
        "+getCategories()",
    ]),
    "Skill Category Keyword": (1590, 600, 230, [
        "-keyword_id: int", "-category_id: int", "-keyword: string",
    ], [
        "+getKeywords()",
    ]),
    "Certificate File": (1590, 40, 270, [
        "-certificate_file_id: int", "-personnel_id: int", "-certification_id: int",
        "-filePath: string", "-mime: string", "-sha256: string",
        "-extractedText: string", "-detectedTitle: string", "-matchConfidence: decimal",
        "-certificateNo: string", "-dateIssued: date", "-expiryDate: date",
        "-status: string", "-reviewNote: string", "-reviewed_by: int",
        "-reviewedAt: datetime", "/authenticity: string",
    ], [
        "+analyzeCertificate()", "+confirmCertificate()", "+reviewCertificate()",
    ]),
    "Certificate Check": (1910, 40, 240, [
        "-check_id: int", "-certificate_file_id: int", "-checkKey: string",
        "-status: string", "-label: string", "-detail: string",
    ], [
        "+getChecks()",
    ]),
    "Certification": (1910, 280, 240, [
        "-certification_id: int", "-cert_name: string", "-category_id: int",
        "-issuer_id: int",
    ], [
        "+getCertifications()",
    ]),
    "Certification Issuer": (2200, 280, 230, [
        "-issuer_id: int", "-issuer_name: string", "-acronym: string",
    ], [
        "+getIssuers()",
    ]),
    "Certification Keyword": (1910, 470, 240, [
        "-cert_keyword_id: int", "-certification_id: int", "-keyword: string",
    ], [
        "+getKeywords()",
    ]),
    "Certification Category": (2200, 470, 230, [
        "-category_id: int", "-category_name: string",
    ], [
        "+getCategories()",
    ]),
    "Certification Category Keyword": (2200, 620, 230, [
        "-keyword_id: int", "-category_id: int", "-keyword: string",
    ], [
        "+getKeywords()",
    ]),
    # ── Roles (subclasses of Personnel) ──
    "Principal": (330, 820, 230, [
        "-personnel_id: int",
    ], [
        "+addUser()", "+updateDelegation()", "+deactivateAccount()",
        "+verifyCertificate()", "+viewAuditLog()", "+assignTask()",
    ]),
    "Dean": (600, 820, 220, [
        "-personnel_id: int",
    ], [
        "+assignTask()", "+viewHandledTeachers()",
    ]),
    "Coordinator": (860, 820, 220, [
        "-personnel_id: int",
    ], [
        "+assignTask()",
    ]),
    "Teacher": (1120, 820, 210, [
        "-personnel_id: int",
    ], [
        "+viewMyTasks()", "+submitReport()",
    ]),
    "Registrar": (1370, 820, 230, [
        "-personnel_id: int",
    ], [
        "+viewPersonnel()", "+deactivateAccount()", "+verifyCertificate()",
        "+assignTask()",
    ]),
    "Dean Assignment": (600, 1040, 220, [
        "-dean_assignment_id: int", "-personnel_id: int", "-grade_level_id: int",
    ], [
        "+getHandledGrade()", "+updateHandledGrade()",
    ]),
    "Coordinator Type": (860, 1040, 230, [
        "-coordinator_type_id: int", "-personnel_id: int", "-coordinator_type: string",
    ], [
        "+getCoordinatorType()", "+updateCoordinatorType()",
    ]),
}

# subclass -> Personnel (generalization)
GENERALIZATIONS = ["Principal", "Dean", "Coordinator", "Teacher", "Registrar"]

# (a, mult_a, label, mult_b, b, exit(x,y), entry(x,y))
ASSOCIATIONS = [
    ("Role", "1", "primary role", "0..*", "Personnel", (1, 0.3), (0, 0.05)),
    ("Personnel", "1", "also holds", "0..*", "User Role", (0, 0.2), (1, 0.5)),
    ("Role", "1", "", "0..*", "User Role", (0.5, 1), (0.5, 0)),
    ("Personnel", "1", "has", "0..1", "Education Background", (0, 0.45), (1, 0.3)),
    ("Personnel", "0..1", "performs", "0..*", "Audit Log", (0.1, 0), (0.5, 0),
     [(669, 18), (160, 18)]),
    ("Audit Log", "1", "", "0..*", "Audit Log Change", (0.5, 1), (0.5, 0)),
    ("Grade Level", "0..1", "advises", "0..*", "Personnel", (0, 0.5), (1, 0.06)),
    ("Personnel", "1", "contains", "0..*", "Load Assignment", (1, 0.25), (0, 0.5)),
    ("Grade Level", "1", "", "0..*", "Load Assignment", (0.5, 1), (0.5, 0)),
    ("Load Assignment", "0..*", "", "1", "Subject", (1, 0.5), (0, 0.5)),
    ("Personnel", "1", "has", "0..*", "Personnel Skill", (1, 0.62), (0, 0.5)),
    ("Personnel Skill", "0..*", "", "1", "Skill", (1, 0.5), (0, 0.5)),
    ("Skill", "1", "suits", "0..*", "Skill Keyword", (0.5, 1), (0.5, 0)),
    ("Skill Category", "0..1", "groups", "0..*", "Skill", (0, 0.5), (1, 0.5)),
    ("Skill Category", "1", "suits", "0..*", "Skill Category Keyword", (0.5, 1), (0.5, 0)),
    ("Personnel", "1", "uploads", "0..*", "Certificate File", (0.9, 0), (0.3, 0),
     [(901, 12), (1671, 12)]),
    ("Certificate File", "1", "", "0..*", "Certificate Check", (1, 0.3), (0, 0.3)),
    ("Certification", "0..1", "identifies", "0..*", "Certificate File", (0, 0.5), (1, 0.7)),
    ("Certification Issuer", "0..1", "issues", "0..*", "Certification", (0, 0.5), (1, 0.5)),
    ("Certification", "1", "suits", "0..*", "Certification Keyword", (0.5, 1), (0.5, 0)),
    ("Certification Category", "0..1", "groups", "0..*", "Certification", (0, 0.3), (1, 0.8)),
    ("Certification Category", "1", "suits", "0..*", "Certification Category Keyword",
     (0.5, 1), (0.5, 0)),
    ("Dean Assignment", "0..*", "covers", "1", "Grade Level", (0, 0.5), (0.5, 0),
     [(305, 1090), (305, 26), (1120, 26)]),
]

# (a, b) — dependency (dashed open arrow), 1..1
DEPENDENCIES = [
    ("Dean", "Dean Assignment"),
    ("Coordinator", "Coordinator Type"),
]

BLACK = "strokeColor=#000000;fontColor=#000000;"


def esc(s):
    return html.escape(s, quote=True)


def section_h(lines):
    return len(lines) * LINE_H + 8


def class_h(attrs, methods):
    return HEAD_H + section_h(attrs) + 8 + section_h(methods)


def build():
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    ids, geo = {}, {}
    for i, (name, (x, y, w, attrs, methods)) in enumerate(CLASSES.items(), start=1):
        cid = f"c{i}"
        ids[name] = cid
        h = class_h(attrs, methods)
        geo[name] = (x, y, w, h)
        cells.append(
            f'<mxCell id="{cid}" value="{esc(name)}" style="swimlane;fontStyle=1;align=center;'
            f'verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize={HEAD_H};'
            f'horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;'
            f'marginBottom=0;whiteSpace=wrap;html=1;fontSize=11;fillColor=#FFFFFF;'
            f'swimlaneFillColor=#FFFFFF;{BLACK}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        text = ("text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;"
                "spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];"
                "portConstraint=eastwest;whiteSpace=wrap;html=1;fontSize=10;fontColor=#000000;")
        ah, mh = section_h(attrs), section_h(methods)
        cells.append(f'<mxCell id="{cid}a" value="{esc("<br>".join(html.escape(a) for a in attrs))}" '
                     f'style="{text}" vertex="1" parent="{cid}"><mxGeometry y="{HEAD_H}" '
                     f'width="{w}" height="{ah}" as="geometry"/></mxCell>')
        cells.append(f'<mxCell id="{cid}l" value="" style="line;strokeWidth=1;fillColor=none;'
                     f'align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;'
                     f'rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;'
                     f'strokeColor=#000000;" vertex="1" parent="{cid}"><mxGeometry '
                     f'y="{HEAD_H + ah}" width="{w}" height="8" as="geometry"/></mxCell>')
        cells.append(f'<mxCell id="{cid}m" value="{esc("<br>".join(html.escape(m) for m in methods))}" '
                     f'style="{text}" vertex="1" parent="{cid}"><mxGeometry y="{HEAD_H + ah + 8}" '
                     f'width="{w}" height="{mh}" as="geometry"/></mxCell>')

    e = 0
    lbl = ("edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];"
           "fontSize=10;fontColor=#000000;")

    def add_edge(src, tgt, style, label="", sl="", tl="", points=()):
        nonlocal e
        e += 1
        eid = f"e{e}"
        pts = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points)
        cells.append(
            f'<mxCell id="{eid}" value="{esc(label)}" style="{style}fontSize=10;{BLACK}" edge="1" '
            f'parent="1" source="{ids[src]}" target="{ids[tgt]}"><mxGeometry relative="1" '
            f'as="geometry">' + (f'<Array as="points">{pts}</Array>' if pts else '')
            + '</mxGeometry></mxCell>')
        for val, pos in ((sl, -0.8), (tl, 0.8)):
            if val:
                cells.append(f'<mxCell id="{eid}{"s" if pos < 0 else "t"}" value="{esc(val)}" '
                             f'style="{lbl}" vertex="1" connectable="0" parent="{eid}">'
                             f'<mxGeometry x="{pos}" y="-8" relative="1" as="geometry">'
                             f'<mxPoint as="offset"/></mxGeometry></mxCell>')

    # generalizations meet on one bus line under Personnel, as in the template
    px, py, pw, ph = geo["Personnel"]
    bus_y = 790      # open band between the upper classes and the role row
    for sub in GENERALIZATIONS:
        sx, sy, sw, sh = geo[sub]
        add_edge(sub, "Personnel",
                 "endArrow=block;endFill=0;endSize=12;html=1;edgeStyle=orthogonalEdgeStyle;"
                 "rounded=0;exitX=0.5;exitY=0;entryX=0.5;entryY=1;",
                 points=[(sx + sw / 2, bus_y), (px + pw / 2, bus_y)])

    for a, ma, label, mb, b, ex, en, *pts in ASSOCIATIONS:
        add_edge(a, b, f"endArrow=none;html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;"
                       f"exitX={ex[0]};exitY={ex[1]};exitDx=0;exitDy=0;"
                       f"entryX={en[0]};entryY={en[1]};entryDx=0;entryDy=0;",
                 label=label, sl=ma, tl=mb, points=pts[0] if pts else ())

    for a, b in DEPENDENCIES:
        add_edge(a, b, "endArrow=open;endFill=0;dashed=1;html=1;edgeStyle=orthogonalEdgeStyle;"
                       "rounded=0;exitX=0.5;exitY=1;entryX=0.5;entryY=0;", sl="1", tl="1")

    width = max(x + w for x, y, w, h in geo.values()) + 40
    height = max(y + h for x, y, w, h in geo.values()) + 40
    body = "\n        ".join(cells)
    return ('<mxfile host="app.diagrams.net" type="device">\n'
            '  <diagram id="personnel-class" name="Personnel Management">\n'
            f'    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
            f'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{width}" '
            f'pageHeight="{height}" math="0" shadow="0">\n'
            '      <root>\n'
            f'        {body}\n'
            '      </root>\n'
            '    </mxGraphModel>\n'
            '  </diagram>\n'
            '</mxfile>\n')


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "personnel_class_diagram.drawio"), "w", encoding="utf-8") as f:
        f.write(build())
    print("wrote personnel_class_diagram.drawio —", len(CLASSES), "classes")
