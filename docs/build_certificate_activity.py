"""Generates certificate_validation_activity.drawio — UML activity diagram
(swimlanes: Principal / Registrar, System, Teacher) of how an uploaded
certificate is read, pre-validated and verified in TaskNet.

Run: python docs/build_certificate_activity.py
"""
import html
import os

cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']

ACT = ("rounded=1;arcSize=40;whiteSpace=wrap;html=1;fontSize=8;fontStyle=1;"
       "fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;")
DEC = ("rhombus;whiteSpace=wrap;html=1;fontSize=8;fontStyle=1;"
       "fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;")
BAR = "rounded=0;html=1;fillColor=#FFFFFF;strokeColor=#000000;"
LANE = ("swimlane;html=1;startSize=22;horizontal=1;fontStyle=1;fontSize=9;"
        "fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;swimlaneFillColor=#FFFFFF;")
EDGE = ("edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;"
        "fontSize=7;strokeColor=#000000;fontColor=#000000;labelBackgroundColor=#FFFFFF;")


# Layout is written on a 590 x 1130 grid (origin 40,20) and scaled to the
# final 600 x 700 page.
PAGE_W, PAGE_H = 600, 700
SX, SY = PAGE_W / 590, PAGE_H / 1130


def X(x):
    return round((x - 40) * SX, 1)


def Y(y):
    return round((y - 20) * SY, 1)


def esc(s):
    return html.escape(s, quote=True)


def node(cid, value, x, y, w, h, style):
    if "ellipse" in style:                 # keep circles round
        d = round(min(w * SX, h * SY * 1.25), 1)
        cx, cy = X(x + w / 2), Y(y + h / 2)
        nx, ny, nw, nh = cx - d / 2, cy - d / 2, d, d
    else:
        nw, nh = round(w * SX, 1), round(h * SY, 1)
        if "rounded=1" in style:           # activities: readable minimum height
            nh = max(nh, 24)
        cy = Y(y + h / 2)
        nx, ny = X(x), round(cy - nh / 2, 1)
        if style.startswith("swimlane"):
            ny = Y(y)
    cells.append(f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="1">'
                 f'<mxGeometry x="{nx}" y="{ny}" width="{nw}" height="{nh}" as="geometry"/></mxCell>')


def act(cid, label, x, y, w=150, h=38):
    node(cid, label, x, y, w, h, ACT)


def edge(cid, src, tgt, label="", exit=None, entry=None, points=()):
    style = EDGE
    if exit:
        style += f"exitX={exit[0]};exitY={exit[1]};exitDx=0;exitDy=0;"
    if entry:
        style += f"entryX={entry[0]};entryY={entry[1]};entryDx=0;entryDy=0;"
    pts = "".join(f'<mxPoint x="{X(x)}" y="{Y(y)}"/>' for x, y in points)
    cells.append(f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" edge="1" parent="1" '
                 f'source="{src}" target="{tgt}"><mxGeometry relative="1" as="geometry">'
                 + (f'<Array as="points">{pts}</Array>' if pts else '')
                 + '</mxGeometry></mxCell>')


# ── Swimlanes ──
H = 1130
node("lane_p", "Principal / Registrar", 40, 20, 190, H, LANE)
node("lane_s", "System", 230, 20, 220, H, LANE)
node("lane_t", "Teacher", 450, 20, 180, H, LANE)

# ── Teacher uploads ──
node("start", "", 525, 65, 26, 26,
     "ellipse;html=1;fillColor=#FFFFFF;strokeColor=#000000;")
act("upload", "Upload Certificate (PDF / Photo)", 463, 110)

# ── System checks the file ──
act("validate", "Validate File Type &amp; Size", 263, 180)
node("d_file", "Valid file?", 296, 245, 85, 70, DEC)
act("retry", "Choose Another File", 463, 261)

act("extract", "Extract Text (PDF Text / OCR)", 263, 355)
act("identify", "Identify Certification &amp; Issuer", 263, 425)

# ── Parallel automated checks ──
node("fork", "", 250, 497, 365, 6, BAR)
act("chk_name", "Match Name &amp; Check Dates", 263, 527)
act("chk_dup", "Check Duplicate File (SHA-256)", 463, 527)
node("join", "", 250, 603, 365, 6, BAR)

act("rating", "Compute Pre-validation Rating", 263, 635)
act("confirm", "Confirm Certification Type", 463, 635)
act("pending", "Save as Pending Review", 263, 705)

# ── Principal / Registrar decides ──
act("review", "Review Certificate &amp; Checks", 60, 705)
node("d_auth", "Authentic?", 92, 775, 85, 70, DEC)
act("reject", "Reject with Reason", 60, 880)
act("verify", "Mark as Verified", 263, 790)

# ── System records the outcome ──
act("credibility", "Update Credibility for Task Suggestions", 263, 880, 150, 42)
act("audit", "Log Review in Audit Trail", 263, 955)
act("notify", "Notify Teacher of Result", 263, 1025)
node("end", "", 525, 1080, 28, 28,
     "ellipse;shape=doubleEllipse;html=1;fillColor=#FFFFFF;strokeColor=#000000;")

# ── Flow ──
edge("e1", "start", "upload")
edge("e2", "upload", "validate", exit=(0.5, 1), entry=(1, 0.5), points=[(538, 199)])
edge("e3", "validate", "d_file")
edge("e4", "d_file", "retry", "No", exit=(1, 0.5), entry=(0, 0.5))
edge("e5", "retry", "upload", "", exit=(1, 0.5), entry=(1, 0.5), points=[(622, 280), (622, 129)])
edge("e6", "d_file", "extract", "Yes", exit=(0.5, 1), entry=(0.5, 0))
edge("e7", "extract", "identify")
edge("e8", "identify", "fork", exit=(0.5, 1), entry=(0.241, 0))
edge("e9", "fork", "chk_name", "Text Read", exit=(0.241, 1), entry=(0.5, 0))
edge("e10", "fork", "chk_dup", "File Hashed", exit=(0.789, 1), entry=(0.5, 0))
edge("e11", "chk_name", "join", "Checked", exit=(0.5, 1), entry=(0.241, 0))
edge("e12", "chk_dup", "join", "Checked", exit=(0.5, 1), entry=(0.789, 0))
edge("e13", "join", "rating", exit=(0.241, 1), entry=(0.5, 0))
edge("e14", "rating", "confirm", "Result Shown", exit=(1, 0.5), entry=(0, 0.5))
edge("e15", "confirm", "pending", "Confirmed", exit=(0.5, 1), entry=(1, 0.5), points=[(538, 724)])
edge("e16", "pending", "review", "For Review", exit=(0, 0.5), entry=(1, 0.5))
edge("e17", "review", "d_auth")
edge("e18", "d_auth", "verify", "Yes", exit=(1, 0.5), entry=(0, 0.5))
edge("e19", "d_auth", "reject", "No", exit=(0.5, 1), entry=(0.5, 0))
edge("e20", "verify", "credibility")
edge("e21", "reject", "credibility", "Rejected", exit=(1, 0.5), entry=(0, 0.5))
edge("e22", "credibility", "audit")
edge("e23", "audit", "notify")
edge("e24", "notify", "end", "Result Sent", exit=(1, 0.5), entry=(0.5, 0), points=[(539, 1044)])

body = "\n        ".join(cells)
XML = ('<mxfile host="app.diagrams.net" type="device">\n'
       '  <diagram id="certificate-activity" name="Certificate Validation">\n'
       '    <mxGraphModel dx="900" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" '
       'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="600" pageHeight="700" '
       'math="0" shadow="0">\n'
       '      <root>\n'
       f'        {body}\n'
       '      </root>\n'
       '    </mxGraphModel>\n'
       '  </diagram>\n'
       '</mxfile>\n')

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "certificate_validation_activity.drawio"), "w",
              encoding="utf-8") as f:
        f.write(XML)
    print("wrote certificate_validation_activity.drawio")
