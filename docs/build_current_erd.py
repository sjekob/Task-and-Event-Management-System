"""Generates docs/tasknet_current_erd.drawio — an ERD of the ACTUAL live SQLite
schema as defined in backend/database.py (CREATE TABLE blocks + the non-destructive
_ensure_column additions). This reflects what the running app really uses, as
opposed to docs/tasknet_erd.drawio which is the idealized normalized design.

Run: python docs/build_current_erd.py
"""
import html
import os
import re

HERE = os.path.dirname(__file__)
DB = os.path.join(HERE, "..", "backend", "database.py")
OUT = os.path.join(HERE, "tasknet_current_erd.drawio")

# Columns added after table creation via _ensure_column (not in the CREATE block).
ENSURE_COLUMNS = {
    "tasks": [("task_category", "", None)],
    "task_assignments": [("target_role", "", None)],
    "events": [("department", "", None), ("expected_attendees", "", None)],
}

ROW_H, HEAD_H, COL_W = 18, 26, 200
GAP_X, GAP_Y = 70, 40
PER_COL = 6  # tables per layout column


def parse_schema(src):
    tables = {}
    for name, body in re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)\s*\((.*?)\n\s*\);", src, re.S):
        cols = []
        for line in body.split("\n"):
            line = line.strip().rstrip(",")
            if not line:
                continue
            up = line.upper()
            if up.startswith(("UNIQUE", "CHECK", "FOREIGN KEY", "PRIMARY KEY(")):
                continue
            tok = line.split()[0]
            if not re.match(r"^[a-z_]+$", tok):
                continue
            fk = re.search(r"REFERENCES (\w+)", line)
            marker = "PK" if "PRIMARY KEY" in up else ("FK" if fk else "")
            cols.append((tok, marker, fk.group(1) if fk else None))
        for extra in ENSURE_COLUMNS.get(name, []):
            if extra[0] not in [c[0] for c in cols]:
                cols.append(extra)
        tables[name] = cols
    return tables


def cell(cid, value, style, parent, x=0, y=0, w=0, h=0, edge=False, source=None, target=None):
    geo = (f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
           if not edge else '<mxGeometry relative="1" as="geometry"/>')
    extra = ' edge="1"' if edge else ' vertex="1"'
    se = f' source="{source}" target="{target}"' if edge else ""
    return (f'<mxCell id="{cid}" value="{html.escape(value)}" style="{style}" '
            f'parent="{parent}"{extra}{se}>{geo}</mxCell>')


def build(tables):
    HEAD = ("swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;"
            "horizontal=1;startSize=26;fillColor=#dae8fc;strokeColor=#6c8ebf;")
    ROW = ("text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;"
           "spacingLeft=8;fontSize=11;")
    ROWPK = ROW + "fontStyle=1;fillColor=#fff2cc;"
    ROWFK = ROW + "fontColor=#9673a6;"
    EDGE = ("edgeStyle=entityRelationEdgeStyle;rounded=0;html=1;endArrow=ERmany;"
            "startArrow=ERone;strokeColor=#9673a6;")

    cells, ids = [], {}
    names = list(tables.keys())
    for i, name in enumerate(names):
        col, rowpos = divmod(i, PER_COL)
        cols = tables[name]
        h = HEAD_H + ROW_H * len(cols)
        # vertical offset within the layout column, stacking by cumulative height
        x = 40 + col * (COL_W + GAP_X)
        y = 40 + rowpos * 0  # placeholder; real y computed below per column
        ids[name] = f"t_{name}"
        cells.append((name, x, len(cols), cols, h))

    # Compute y per layout column so tables stack without overlap.
    col_y = {}
    placed = {}
    for name, x, ncol, cols, h in cells:
        c = (x - 40) // (COL_W + GAP_X)
        y = col_y.get(c, 40)
        placed[name] = (x, y, h, cols)
        col_y[c] = y + h + GAP_Y

    body = []
    for name, (x, y, h, cols) in placed.items():
        tid = ids[name]
        body.append(cell(tid, name.upper(), HEAD, "1", x, y, COL_W, h))
        for j, (col, marker, _) in enumerate(cols):
            label = col + (f"  ({marker})" if marker else "")
            st = ROWPK if marker == "PK" else (ROWFK if marker == "FK" else ROW)
            body.append(cell(f"{tid}_{j}", label, st, tid, 0, HEAD_H + j * ROW_H, COL_W, ROW_H))

    # FK edges
    e = 0
    for name, cols in tables.items():
        for col, marker, target in cols:
            if marker == "FK" and target in ids and target != name:
                e += 1
                body.append(cell(f"e{e}", "", EDGE, "1", edge=True,
                                 source=ids[name], target=ids[target]))

    xml = ('<mxfile><diagram name="TaskNet Current Schema"><mxGraphModel '
           'dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
           'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2400" '
           'pageHeight="2200" math="0" shadow="0"><root>'
           '<mxCell id="0"/><mxCell id="1" parent="0"/>'
           + "".join(body) +
           '</root></mxGraphModel></diagram></mxfile>')
    return xml


def main():
    src = open(DB, encoding="utf-8").read()
    tables = parse_schema(src)
    xml = build(tables)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(xml)
    print(f"Wrote {OUT} — {len(tables)} tables")


if __name__ == "__main__":
    main()
