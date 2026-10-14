"""Generates skills_activity.drawio — UML activity diagram (swimlanes: Teacher,
System) of a teacher choosing their skills on their profile. Only the owner
edits their own skills; picks are limited to the skill catalog.

Run: python docs/build_skills_activity.py
"""
import html
import os

cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']

ACT = ("rounded=1;arcSize=40;whiteSpace=wrap;html=1;fontSize=8;fontStyle=1;"
       "fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;")
DEC = ("rhombus;whiteSpace=wrap;html=1;fontSize=8;fontStyle=1;"
       "fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;")
LANE = ("swimlane;html=1;startSize=22;horizontal=1;fontStyle=1;fontSize=9;"
        "fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;swimlaneFillColor=#FFFFFF;")
EDGE = ("edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;"
        "fontSize=7;strokeColor=#000000;fontColor=#000000;labelBackgroundColor=#FFFFFF;")

# Layout is written on a 590 x 900 grid (origin 40,20) and scaled to the
# final 600 x 700 page.
PAGE_W, PAGE_H = 600, 700
GRID_W, GRID_H = 590, 900
SX, SY = PAGE_W / GRID_W, PAGE_H / GRID_H


def X(x):
    return round((x - 40) * SX, 1)


def Y(y):
    return round((y - 20) * SY, 1)


def esc(s):
    return html.escape(s, quote=True)


def node(cid, value, x, y, w, h, style):
    if "ellipse" in style:                 # keep circles round
        d = round(min(w * SX, h * SY * 1.15), 1)
        cx, cy = X(x + w / 2), Y(y + h / 2)
        nx, ny, nw, nh = cx - d / 2, cy - d / 2, d, d
    else:
        nw, nh = round(w * SX, 1), round(h * SY, 1)
        if "rounded=1" in style:           # activities: readable minimum height
            nh = max(nh, 26)
        cy = Y(y + h / 2)
        nx, ny = X(x), round(cy - nh / 2, 1)
        if style.startswith("swimlane"):
            ny = Y(y)
    cells.append(f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="1">'
                 f'<mxGeometry x="{nx}" y="{ny}" width="{nw}" height="{nh}" as="geometry"/></mxCell>')


def act(cid, label, x, y, w=170, h=36):
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


# ── Swimlanes ── (Teacher 40-335, System 335-630; activity centres 187 / 482)
node("lane_t", "Teacher", 40, 20, 295, GRID_H, LANE)
node("lane_s", "System", 335, 20, 295, GRID_H, LANE)
TX, SXC = 102, 397          # left edge of a 170-wide activity in each lane

node("start", "", 174, 58, 26, 26, "ellipse;html=1;fillColor=#FFFFFF;strokeColor=#000000;")
act("profile", "Open My Profile", TX, 100)
act("edit", "Click Edit Profile", TX, 160)
act("catalog", "Load Skill Catalog", SXC, 160)
act("group", "Show Skills Grouped by Category", SXC, 220)
act("select", "Search &amp; Select a Skill", TX, 280)
node("d_more", "Add another skill?", 140, 340, 95, 70, DEC)
act("save", "Click Save", TX, 450)
act("validate", "Validate Skills Against Catalog", SXC, 450)
node("d_valid", "All skills in catalog?", 435, 512, 95, 70, DEC)
act("fix", "Remove Unlisted Skill", TX, 529)
act("store", "Replace Profile Skills", SXC, 625)
act("refresh", "Refresh Profile", SXC, 690)
act("view", "View Updated Skills", TX, 690)
node("end", "", 172, 790, 30, 30,
     "ellipse;shape=doubleEllipse;html=1;fillColor=#FFFFFF;strokeColor=#000000;")

edge("e1", "start", "profile")
edge("e2", "profile", "edit")
edge("e3", "edit", "catalog", "Edit Opened", exit=(1, 0.5), entry=(0, 0.5))
edge("e4", "catalog", "group")
edge("e5", "group", "select", "Options Shown", exit=(0.5, 1), entry=(1, 0.5), points=[(482, 298)])
edge("e6", "select", "d_more")
edge("e7", "d_more", "select", "Yes", exit=(0, 0.5), entry=(0, 0.5), points=[(70, 375), (70, 298)])
edge("e8", "d_more", "save", "No", exit=(0.5, 1), entry=(0.5, 0))
edge("e9", "save", "validate", "Skills Sent", exit=(1, 0.5), entry=(0, 0.5))
edge("e10", "validate", "d_valid")
edge("e11", "d_valid", "fix", "No", exit=(0, 0.5), entry=(1, 0.5))
edge("e12", "fix", "select", "", exit=(0, 0.5), entry=(0, 0.25), points=[(55, 547), (55, 289)])
edge("e13", "d_valid", "store", "Yes", exit=(0.5, 1), entry=(0.5, 0))
edge("e14", "store", "refresh")
edge("e15", "refresh", "view", "Profile Updated", exit=(0, 0.5), entry=(1, 0.5))
edge("e16", "view", "end", exit=(0.5, 1), entry=(0.5, 0))

body = "\n        ".join(cells)
XML = ('<mxfile host="app.diagrams.net" type="device">\n'
       '  <diagram id="skills-activity" name="Choosing Skills">\n'
       f'    <mxGraphModel dx="900" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" '
       f'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{PAGE_W}" '
       f'pageHeight="{PAGE_H}" math="0" shadow="0">\n'
       '      <root>\n'
       f'        {body}\n'
       '      </root>\n'
       '    </mxGraphModel>\n'
       '  </diagram>\n'
       '</mxfile>\n')

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "skills_activity.drawio"), "w", encoding="utf-8") as f:
        f.write(XML)
    print("wrote skills_activity.drawio")
