"""
erd_drawio.py — Draw every stored table (schema.py) as one draw.io ERD page
whose relationship lines never cross each other or pass through a table.

Reads the live database's catalog, so the diagram always matches the schema.
Each table lists its columns (PK / FK marked, FK columns name the table they
point to); one crow's-foot line joins each pair of related tables.

How the layout avoids crossings: the foreign-key graph is planar, so a planar
straight-line drawing exists (networkx gives one). It is scaled up until no
table overlaps another or sits on a line, then compacted step by step — every
move is kept only if it introduces no crossing, no line through a table and no
overlap. Lines are straight (center to center), so what is checked is what
draw.io shows.

    pip install networkx numpy        # layout only; not needed by the app
    python -m tools.erd_drawio docs/TaskNet_ERD.drawio
    python -m tools.erd_drawio out.drawio --catalog catalog.json   # without a database
"""
import json
import random
import sys
from html import escape

W, ROW, HEAD = 300, 22, 30
GAP = 40          # clear space kept around every table
LINE_GAP = 14     # clear space between a line and a table it doesn't touch


def catalog(db):
    tables = {}
    for r in db.execute("""SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c
                           JOIN information_schema.tables t USING (table_schema, table_name)
                           WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
                           ORDER BY c.table_name, c.ordinal_position""").fetchall():
        tables.setdefault(r["table_name"], []).append((r["column_name"], r["data_type"]))
    pks = {(r["table_name"], r["column_name"]) for r in db.execute(
        """SELECT kcu.table_name, kcu.column_name FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name)
           WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public'""").fetchall()}
    fks = [(r["src"], r["col"], r["dst"]) for r in db.execute(
        """SELECT kcu.table_name AS src, kcu.column_name AS col, ccu.table_name AS dst
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name)
           JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
           WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'""").fetchall()]
    return tables, pks, fks


# ── Layout ───────────────────────────────────────────────────────────────────

class Layout:
    """Table centers (x, y) with sizes; checks the no-crossing rules with numpy."""

    def __init__(self, names, sizes, edges, pos):
        import numpy as np
        self.np = np
        self.names = names
        self.idx = {n: i for i, n in enumerate(names)}
        self.half = np.array([[w / 2, h / 2] for w, h in sizes], dtype=float)
        self.edges = np.array([(self.idx[a], self.idx[b]) for a, b in edges], dtype=int)
        self.pos = np.array([pos[n] for n in names], dtype=float)
        self.incident = [np.where((self.edges[:, 0] == i) | (self.edges[:, 1] == i))[0] for i in range(len(names))]

    # Geometry helpers -------------------------------------------------------
    def _cross(self, p1, p2, q1, q2):
        """Proper intersection of segments p1p2 (k×2) with q1q2 (m×2) → k×m bool."""
        np = self.np

        def orient(a, b, c):
            return (b[..., 0] - a[..., 0]) * (c[..., 1] - a[..., 1]) - (b[..., 1] - a[..., 1]) * (c[..., 0] - a[..., 0])
        P1, P2 = p1[:, None, :], p2[:, None, :]
        Q1, Q2 = q1[None, :, :], q2[None, :, :]
        d1, d2 = orient(Q1, Q2, P1), orient(Q1, Q2, P2)
        d3, d4 = orient(P1, P2, Q1), orient(P1, P2, Q2)
        return (d1 * d2 < 0) & (d3 * d4 < 0)

    def _seg_box(self, a, b, center, half):
        """Segments ab (k×2) hitting boxes (m, inflated by LINE_GAP) → k×m bool (Liang–Barsky)."""
        np = self.np
        lo = (center - half - LINE_GAP)[None, :, :]
        hi = (center + half + LINE_GAP)[None, :, :]
        A, D = a[:, None, :], (b - a)[:, None, :]
        with np.errstate(divide="ignore", invalid="ignore"):
            t1, t2 = (lo - A) / D, (hi - A) / D
        tmin = np.where(D == 0, np.where((A >= lo) & (A <= hi), -np.inf, np.inf), np.minimum(t1, t2))
        tmax = np.where(D == 0, np.where((A >= lo) & (A <= hi), np.inf, -np.inf), np.maximum(t1, t2))
        enter = np.maximum(np.maximum(tmin[..., 0], tmin[..., 1]), 0.0)
        leave = np.minimum(np.minimum(tmax[..., 0], tmax[..., 1]), 1.0)
        return enter <= leave

    def violations(self, i, p):
        """How many rules table i at center p would break (overlaps, crossings, lines through tables)."""
        np = self.np
        pos = self.pos.copy()
        pos[i] = p
        others = np.arange(len(pos)) != i
        gap = np.abs(pos[others] - p) - (self.half[others] + self.half[i] + GAP)
        bad = int((np.max(gap, axis=1) < 0).sum())
        E = self.edges
        mine = self.incident[i]
        rest = np.setdiff1d(np.arange(len(E)), mine)
        if len(mine):
            a, b = pos[E[mine, 0]], pos[E[mine, 1]]
            x = self._cross(a, b, pos[E[rest, 0]], pos[E[rest, 1]])
            shared = ((E[mine, 0][:, None] == E[rest, 0][None, :]) | (E[mine, 0][:, None] == E[rest, 1][None, :])
                      | (E[mine, 1][:, None] == E[rest, 0][None, :]) | (E[mine, 1][:, None] == E[rest, 1][None, :]))
            bad += int((x & ~shared).sum())
            hit = self._seg_box(a, b, pos, self.half)
            hit[np.arange(len(mine)), E[mine, 0]] = False
            hit[np.arange(len(mine)), E[mine, 1]] = False
            bad += int(hit.sum())
        far = rest[(E[rest, 0] != i) & (E[rest, 1] != i)]
        if len(far):
            bad += int(self._seg_box(pos[E[far, 0]], pos[E[far, 1]], p[None, :], self.half[i:i + 1]).sum())
        return bad

    def ok_node(self, i, p):
        """Would table i at center p keep every rule?"""
        return self.violations(i, p) == 0

    def untangle(self, seed, steps=40000):
        """Moves tables until no rule is broken; False when it gets stuck."""
        np = self.np
        rng = random.Random(seed)
        n = len(self.pos)
        bad = [self.violations(i, self.pos[i]) for i in range(n)]
        for k in range(steps):
            culprits = [i for i in range(n) if bad[i]]
            if not culprits:
                return True
            i = rng.choice(culprits) if rng.random() < 0.8 else rng.randrange(n)
            mine = self.incident[i]
            ends = np.where(self.edges[mine, 0] == i, self.edges[mine, 1], self.edges[mine, 0])
            r = rng.uniform(150, 1500)
            base = self.pos[ends[rng.randrange(len(ends))]] if len(mine) and rng.random() < 0.6 else self.pos[i]
            ang = rng.uniform(0, 6.2832)
            p = base + np.array([np.cos(ang) * r, np.sin(ang) * r])
            new = self.violations(i, p)
            if new < bad[i] or (new == bad[i] and rng.random() < 0.3):
                self.pos[i] = p
                bad = [self.violations(j, self.pos[j]) for j in range(n)] if new else bad
                if not new:
                    bad = [self.violations(j, self.pos[j]) for j in range(n)]
        return False

    def ok_all(self):
        return all(self.ok_node(i, self.pos[i]) for i in range(len(self.pos)))

    def cost_node(self, i, p):
        np = self.np
        mine = self.incident[i]
        ends = np.where(self.edges[mine, 0] == i, self.edges[mine, 1], self.edges[mine, 0])
        length = np.sum(np.hypot(*(self.pos[ends] - p).T)) if len(mine) else 0.0
        centre = self.pos.mean(axis=0)
        return length + 0.35 * np.hypot(*(p - centre))   # short lines, compact sheet

    # Search -----------------------------------------------------------------
    def compact(self, rounds=80, seed=7):
        np = self.np
        rng = random.Random(seed)
        n = len(self.pos)
        for r in range(rounds):
            # Shrink everything toward the middle while it stays valid.
            c = self.pos.mean(axis=0)
            for f in (0.85, 0.93, 0.97, 0.99):
                old = self.pos.copy()
                self.pos = c + (self.pos - c) * f
                if not self.ok_all():
                    self.pos = old
            step = max(30.0, 400.0 * (1 - r / rounds))
            order = list(range(n))
            rng.shuffle(order)
            for i in order:
                best, best_cost = None, self.cost_node(i, self.pos[i])
                mine = self.incident[i]
                ends = np.where(self.edges[mine, 0] == i, self.edges[mine, 1], self.edges[mine, 0])
                targets = [self.pos[ends].mean(axis=0)] if len(mine) else []
                targets.append(self.pos.mean(axis=0))
                cands = [self.pos[i] + (t - self.pos[i]) * k for t in targets for k in (0.05, 0.15, 0.35, 0.6)]
                cands += [self.pos[i] + np.array([rng.uniform(-step, step), rng.uniform(-step, step)]) for _ in range(10)]
                for p in cands:
                    cost = self.cost_node(i, p)
                    if cost < best_cost - 1 and self.ok_node(i, p):
                        best, best_cost = p, cost
                if best is not None:
                    self.pos[i] = best
            # Groups hanging off one line (e.g. the skill tables) move as a unit.
            for members, inner, outer in self.groups:
                self._pull_group(members, inner, outer, rng)

    groups = ()

    def _pull_group(self, members, inner, outer, rng):
        np = self.np
        centre = self.pos.mean(axis=0)

        def cost():
            return (np.hypot(*(self.pos[inner] - self.pos[outer]))
                    + 0.35 * np.hypot(*(self.pos[members].mean(axis=0) - centre)))
        before = cost()
        towards = [self.pos[outer] - self.pos[inner], centre - self.pos[members].mean(axis=0)]
        for t in towards:
            for k in (0.4, 0.25, 0.12, 0.05):
                old = self.pos[members].copy()
                self.pos[members] = old + t * k
                if cost() < before - 1 and all(self.violations(j, self.pos[j]) == 0 for j in members):
                    return
                self.pos[members] = old


def layout(tables, fks):
    """Centers {table: (x, y)} and the related pairs [(many, one)], crossing-free."""
    import networkx as nx
    import numpy as np
    names = sorted(tables)
    sizes = [(W, HEAD + ROW * len(tables[t])) for t in names]
    pairs = {}
    for src, _col, dst in fks:
        if src != dst and (dst, src) not in pairs:
            pairs[(src, dst)] = True
    G = nx.Graph()
    G.add_nodes_from(names)
    G.add_edges_from(pairs)
    ok, _ = nx.check_planarity(G)
    if not ok:
        raise SystemExit("The foreign-key graph is not planar: a crossing-free drawing is impossible.")
    # Pendant groups: the small side of each bridge (a line whose removal splits the diagram).
    groups = []
    for a, b in nx.bridges(G):
        H = G.copy()
        H.remove_edge(a, b)
        side_a, side_b = nx.node_connected_component(H, a), nx.node_connected_component(H, b)
        small, inner, outer = (side_a, a, b) if len(side_a) <= len(side_b) else (side_b, b, a)
        if 1 < len(small) <= 12:
            groups.append((sorted(small), inner, outer))
    best = None
    for seed in range(1, 7):
        raw = nx.spring_layout(G, seed=seed, k=1.6 / len(names) ** 0.5, iterations=300)
        lay = Layout(names, sizes, list(pairs), {n: (raw[n][0] * 9000, raw[n][1] * 9000) for n in names})
        lay.groups = [(np.array([lay.idx[m] for m in g]), lay.idx[i], lay.idx[o]) for g, i, o in groups]
        if not lay.untangle(seed):
            continue
        lay.compact(seed=seed)
        if not lay.ok_all():
            continue
        span = lay.pos.max(axis=0) - lay.pos.min(axis=0)
        if best is None or span[0] * span[1] < best[0]:
            best = (span[0] * span[1], lay)
    if best is None:
        raise SystemExit("Couldn't find a crossing-free layout.")
    lay = best[1]
    if not lay.ok_all():
        raise SystemExit("Layout check failed.")
    return {n: tuple(lay.pos[lay.idx[n]]) for n in names}, list(pairs), dict(zip(names, sizes))


# ── draw.io ──────────────────────────────────────────────────────────────────

def drawio(tables, pks, fks, centers, pairs, sizes) -> str:
    cells, ids, n = [], {}, [2]

    def nid():
        n[0] += 1
        return str(n[0])

    fk_of = {}
    for src, col, dst in fks:
        fk_of.setdefault((src, col), dst)
    min_x = min(centers[t][0] - sizes[t][0] / 2 for t in centers)
    min_y = min(centers[t][1] - sizes[t][1] / 2 for t in centers)
    for t in sorted(tables):
        w, h = sizes[t]
        x = round(centers[t][0] - w / 2 - min_x + 40)
        y = round(centers[t][1] - h / 2 - min_y + 40)
        tid = nid()
        ids[t] = tid
        cells.append(f'<mxCell id="{tid}" value="{escape(t.upper())}" style="shape=table;startSize={HEAD};container=1;collapsible=0;'
                     f'childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;html=1;'
                     f'fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;" vertex="1" parent="1">'
                     f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        for i, (c, dtype) in enumerate(tables[t]):
            pk, fk = (t, c) in pks, (t, c) in fk_of
            key = "PK,FK" if pk and fk else "PK" if pk else "FK" if fk else ""
            label = f"{c} → {fk_of[(t, c)]}" if fk else c
            rid, kid, cid = nid(), nid(), nid()
            cells.append(f'<mxCell id="{rid}" value="" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=#ffffff;'
                         f'collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;top=0;left=0;right=0;bottom={1 if i == 0 else 0};" '
                         f'vertex="1" parent="{tid}"><mxGeometry y="{HEAD + i * ROW}" width="{w}" height="{ROW}" as="geometry"/></mxCell>')
            cells.append(f'<mxCell id="{kid}" value="{key}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;'
                         f'fontStyle=1;overflow=hidden;html=1;fontSize=10;fontColor=#000000;" vertex="1" parent="{rid}"><mxGeometry width="44" height="{ROW}" as="geometry"/></mxCell>')
            style = "fontStyle=5;" if pk else ""
            cells.append(f'<mxCell id="{cid}" value="{escape(label)} : {escape(dtype)}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;'
                         f'bottom=0;right=0;align=left;spacingLeft=6;overflow=hidden;html=1;fontSize=11;fontColor=#000000;{style}" vertex="1" parent="{rid}">'
                         f'<mxGeometry x="44" width="{w - 44}" height="{ROW}" as="geometry"/></mxCell>')
    for src, dst in pairs:
        # Straight line (no routing), many side at the referencing table.
        cells.append(f'<mxCell id="{nid()}" style="edgeStyle=none;rounded=0;html=1;endArrow=ERmandOne;startArrow=ERmany;'
                     f'endFill=0;startFill=0;strokeColor=#000000;" edge="1" parent="1" source="{ids[src]}" target="{ids[dst]}">'
                     f'<mxGeometry relative="1" as="geometry"/></mxCell>')
    return (f'<mxfile host="TaskNet"><diagram name="TaskNet ERD" id="tasknet-erd"><mxGraphModel grid="1" gridSize="10" page="0">'
            f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>{"".join(cells)}</root></mxGraphModel></diagram></mxfile>')


def main(out: str, catalog_json: str = None):
    if catalog_json:
        d = json.load(open(catalog_json, encoding="utf-8"))
        tables = {t: [tuple(c) for c in cols] for t, cols in d["tables"].items()}
        pks, fks = {tuple(p) for p in d["pks"]}, [tuple(f) for f in d["fks"]]
    else:
        from database import connect_db
        db = connect_db()
        try:
            tables, pks, fks = catalog(db)
        finally:
            db.close()
    centers, pairs, sizes = layout(tables, fks)
    with open(out, "w", encoding="utf-8") as f:
        f.write(drawio(tables, pks, fks, centers, pairs, sizes))
    print(f"{out}: {len(tables)} tables, {len(fks)} foreign keys as {len(pairs)} lines, one page, no crossings")


if __name__ == "__main__":
    args = sys.argv[1:]
    cat = None
    if "--catalog" in args:
        k = args.index("--catalog")
        cat = args[k + 1]
        del args[k:k + 2]
    main(args[0] if args else "TaskNet_ERD.drawio", cat)
