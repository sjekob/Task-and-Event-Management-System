"""Generates personnel_class_diagram.drawio (+ .svg) — the Personnel Management
UML class diagram, with the Leave Request and Leave Credit classes (and their
associations to Personnel) OMITTED.

Run: python docs/build_personnel_class_diagram.py
"""
import html
import os

ROW_H = 16
HEAD_H = 26
SEP = 10
COL_W = 230

# name -> (x, y, width, [attributes], [methods])
CLASSES = {
    "Personnel": (380, 20, 250, [
        "-personnel_id: int", "-firstName: string", "-middleName: string",
        "-lastName: string", "-suffix: string", "-username: string",
        "-password: string", "-email: string", "-contactNumber: int",
        "-birthdate: date", "-administrativeRole: string", "-tinNumber: int",
        "-GSISNumber: int", "-PHICNumber: int", "-address: string",
        "-plantillaNumber: int", "-date_of_appointment: date",
        "-hdfmNumber: int", "-isActive: bool",
    ], [
        "+getPersonalInformation()", "+updatePersonalInformation()",
        "+authenticateUser()",
    ]),
    "Grade Level": (820, 20, 220, [
        "-grade_level_id: int", "-grade_level: string",
    ], [
        "+getGradeLevel()", "+addGradeLevel()",
    ]),
    "Load Assignment": (820, 240, 230, [
        "-load_assign_id: int", "-personnel_id: int", "-subject_id: int",
        "-grade_level_id: int", "-createdAt: date", "-updatedAt: date",
    ], [
        "+getLoadAssignment()", "+assignLoadAssignment()", "+updateLoadAssignment()",
    ]),
    "Subject": (1120, 300, 210, [
        "-subject_id: int", "-subject_name: string",
    ], [
        "+getSubject()",
    ]),
    "Principal": (40, 880, 230, [
        "-personnel_id: int",
    ], [
        "+deactivateAccount()", "+addUser()",
        "+updateLoadAssignment()", "+addLoadAssignment()",
    ]),
    "Dean": (310, 880, 220, [
        "-personnel_id: int", "-department_id: int",
    ], [
        "+fileLeaveRequest()", "+viewLeaveCredits()",
    ]),
    "Coordinator": (570, 880, 220, [
        "-personnel_id: int", "-coordinator_type_id: int",
    ], [
        "+fileLeaveRequest()", "+viewLeaveCredits()",
    ]),
    "Teacher": (830, 880, 210, [
        "-personnel_id: int",
    ], [
        "+fileLeaveRequest()", "+viewLeaveCredits()",
    ]),
    "Registrar": (1090, 870, 230, [
        "-personnel_id: int",
    ], [
        "+deactivateAccount()", "+addUser()",
        "+fileLeaveRequest()", "+viewLeaveCredits()",
    ]),
    "Department": (310, 1110, 220, [
        "-department_id: int", "-department_name: string",
    ], [
        "+getDepartment()", "+updateDepartment()", "+addDepartment()",
    ]),
    "Coordinator Type": (570, 1110, 230, [
        "-coordinator_type_id: int", "-coordinator_type: string",
    ], [
        "+getCoordinatorType()", "+updateCoordinatorType()", "+addCoordinatorType()",
    ]),
}

# subclass -> Personnel  (generalization / inheritance)
GENERALIZATIONS = ["Principal", "Dean", "Coordinator", "Teacher", "Registrar"]

# (a, mult_a, label, mult_b, b) — plain association
ASSOCIATIONS = [
    ("Personnel", "1", "contains", "1..*", "Load Assignment"),
    ("Grade Level", "1", "", "1..*", "Load Assignment"),
    ("Load Assignment", "1..*", "", "1", "Subject"),
]

# (a, b) — dependency (dashed open arrow), 1..1
DEPENDENCIES = [
    ("Dean", "Department"),
    ("Coordinator", "Coordinator Type"),
]


def esc(s):
    return html.escape(s, quote=True)


def box_h(attrs, methods):
    return HEAD_H + (len(attrs) + len(methods)) * ROW_H + 2 * SEP + 6


def class_value(name, attrs, methods):
    raw = (f'<div style="text-align:center"><b>{name}</b></div>'
           '<hr size="1">'
           + '<br>'.join(attrs) +
           '<hr size="1">'
           + '<br>'.join(methods))
    return esc(raw)


def build_drawio():
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    ids = {}
    for i, (name, (x, y, w, attrs, methods)) in enumerate(CLASSES.items(), start=2):
        cid = f"c{i}"
        ids[name] = cid
        h = box_h(attrs, methods)
        style = ("rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;align=left;"
                 "spacingLeft=8;spacingTop=4;fillColor=#ffffff;strokeColor=#000000;fontSize=11;")
        cells.append(
            f'<mxCell id="{cid}" value="{class_value(name, attrs, methods)}" style="{style}" '
            f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'
        )

    e = 0

    def add_edge(src, tgt, style, label="", sl="", tl=""):
        nonlocal e
        e += 1
        eid = f"e{e}"
        cells.append(
            f'<mxCell id="{eid}" value="{esc(label)}" style="{style}" edge="1" parent="1" '
            f'source="{ids[src]}" target="{ids[tgt]}"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )
        lbl = ("edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];"
               "fontSize=10;")
        if sl:
            cells.append(f'<mxCell id="{eid}s" value="{esc(sl)}" style="{lbl}" vertex="1" '
                         f'connectable="0" parent="{eid}"><mxGeometry x="-0.75" relative="1" '
                         f'as="geometry"><mxPoint as="offset"/></mxGeometry></mxCell>')
        if tl:
            cells.append(f'<mxCell id="{eid}t" value="{esc(tl)}" style="{lbl}" vertex="1" '
                         f'connectable="0" parent="{eid}"><mxGeometry x="0.75" relative="1" '
                         f'as="geometry"><mxPoint as="offset"/></mxGeometry></mxCell>')

    gen_style = ("endArrow=block;endFill=0;endSize=14;html=1;edgeStyle=orthogonalEdgeStyle;"
                 "rounded=0;exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
    for sub in GENERALIZATIONS:
        add_edge(sub, "Personnel", gen_style)

    assoc_style = "endArrow=none;html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;"
    for a, ma, label, mb, b in ASSOCIATIONS:
        add_edge(a, b, assoc_style, label=label, sl=ma, tl=mb)

    dep_style = "endArrow=open;dashed=1;html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;"
    for a, b in DEPENDENCIES:
        add_edge(a, b, dep_style, sl="1", tl="1")

    body = "\n        ".join(cells)
    return (
        '<mxfile host="app.diagrams.net" type="device">\n'
        '  <diagram id="personnel-class" name="Personnel Management">\n'
        '    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
        'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1500" pageHeight="1350" '
        'math="0" shadow="0">\n'
        '      <root>\n'
        f'        {body}\n'
        '      </root>\n'
        '    </mxGraphModel>\n'
        '  </diagram>\n'
        '</mxfile>\n'
    )


def build_svg():
    pad = 40
    maxx = max(x + w for x, y, w, a, m in CLASSES.values())
    maxy = max(y + box_h(a, m) for x, y, w, a, m in CLASSES.values())
    W, H = maxx + pad, maxy + pad
    cx = {n: (x + w / 2) for n, (x, y, w, a, m) in CLASSES.items()}
    box = {n: (x, y, w, box_h(a, m)) for n, (x, y, w, a, m) in CLASSES.items()}

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
         f'viewBox="0 0 {W} {H}" font-family="Helvetica,Arial,sans-serif">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         '<defs><marker id="tri" markerWidth="16" markerHeight="14" refX="14" refY="7" orient="auto">'
         '<path d="M0,0 L14,7 L0,14 Z" fill="#ffffff" stroke="#1a1a2e"/></marker>'
         '<marker id="open" markerWidth="12" markerHeight="12" refX="9" refY="5" orient="auto">'
         '<path d="M0,0 L9,5 L0,10" fill="none" stroke="#5a6472"/></marker></defs>']

    def center_bottom(n):
        x, y, w, h = box[n]; return (x + w / 2, y + h)
    def center_top(n):
        x, y, w, h = box[n]; return (x + w / 2, y)

    # generalizations: subclass top -> Personnel bottom
    pb = center_bottom("Personnel")
    for sub in GENERALIZATIONS:
        sx, sy = center_top(sub)
        midy = (sy + pb[1]) / 2
        p.append(f'<polyline points="{sx:.0f},{sy:.0f} {sx:.0f},{midy:.0f} {pb[0]:.0f},{midy:.0f} '
                 f'{pb[0]:.0f},{pb[1]:.0f}" fill="none" stroke="#1a1a2e" marker-end="url(#tri)"/>')

    def edge_pts(a, b):
        ax, ay, aw, ah = box[a]; bx, by, bw, bh = box[b]
        # connect nearest horizontal/vertical sides (simple)
        a_cx, a_cy = ax + aw / 2, ay + ah / 2
        b_cx, b_cy = bx + bw / 2, by + bh / 2
        if abs(a_cx - b_cx) >= abs(a_cy - b_cy):
            x1 = ax + aw if b_cx > a_cx else ax
            x2 = bx if b_cx > a_cx else bx + bw
            return (x1, a_cy, x2, b_cy)
        else:
            y1 = ay + ah if b_cy > a_cy else ay
            y2 = by if b_cy > a_cy else by + bh
            return (a_cx, y1, b_cx, y2)

    for a, ma, label, mb, b in ASSOCIATIONS:
        x1, y1, x2, y2 = edge_pts(a, b)
        p.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#1a1a2e"/>')
        if label:
            p.append(f'<text x="{(x1+x2)/2:.0f}" y="{(y1+y2)/2-3:.0f}" font-size="10" '
                     f'fill="#5a6472" text-anchor="middle">{esc(label)}</text>')
        p.append(f'<text x="{x1:.0f}" y="{y1-3:.0f}" font-size="9" fill="#5a6472" text-anchor="middle">{ma}</text>')
        p.append(f'<text x="{x2:.0f}" y="{y2-3:.0f}" font-size="9" fill="#5a6472" text-anchor="middle">{mb}</text>')

    for a, b in DEPENDENCIES:
        x1, y1, x2, y2 = edge_pts(a, b)
        p.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#5a6472" '
                 f'stroke-dasharray="5,4" marker-end="url(#open)"/>')

    for name, (x, y, w, attrs, methods) in CLASSES.items():
        h = box_h(attrs, methods)
        p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#ffffff" stroke="#1a1a2e"/>')
        p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{HEAD_H}" fill="#dce6f5" stroke="#1a1a2e"/>')
        p.append(f'<text x="{x+w/2:.0f}" y="{y+18:.0f}" font-size="12" font-weight="bold" '
                 f'text-anchor="middle">{esc(name)}</text>')
        ty = y + HEAD_H + SEP
        for a in attrs:
            ty += ROW_H
            p.append(f'<text x="{x+8}" y="{ty-4:.0f}" font-size="10">{esc(a)}</text>')
        sepy = ty + 4
        p.append(f'<line x1="{x}" y1="{sepy:.0f}" x2="{x+w}" y2="{sepy:.0f}" stroke="#1a1a2e"/>')
        ty = sepy + SEP
        for m in methods:
            ty += ROW_H
            p.append(f'<text x="{x+8}" y="{ty-4:.0f}" font-size="10">{esc(m)}</text>')
    p.append('</svg>')
    return "\n".join(p)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "personnel_class_diagram.drawio"), "w", encoding="utf-8") as f:
        f.write(build_drawio())
    with open(os.path.join(here, "personnel_class_diagram.svg"), "w", encoding="utf-8") as f:
        f.write(build_svg())
    print("wrote personnel_class_diagram.drawio + .svg —", len(CLASSES), "classes "
          "(Leave Request / Leave Credit omitted)")
