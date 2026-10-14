"""Generates certificate_validation_sequence.drawio — UML sequence diagram of
certificate upload, automated pre-validation and principal/registrar review.

Run: python docs/build_certificate_sequence.py
"""
import html
import os

cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
n = 0


def esc(s):
    return html.escape(s, quote=True)


def nid(prefix):
    global n
    n += 1
    return f"{prefix}{n}"


def vertex(value, x, y, w, h, style):
    cells.append(f'<mxCell id="{nid("v")}" value="{esc(value)}" style="{style}" vertex="1" '
                 f'parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" '
                 f'as="geometry"/></mxCell>')


def line(x1, y1, x2, y2, style, label=""):
    cells.append(f'<mxCell id="{nid("e")}" value="{esc(label)}" style="{style}" edge="1" '
                 f'parent="1"><mxGeometry relative="1" as="geometry">'
                 f'<mxPoint x="{x1}" y="{y1}" as="sourcePoint"/>'
                 f'<mxPoint x="{x2}" y="{y2}" as="targetPoint"/></mxGeometry></mxCell>')


BLACK = "strokeColor=#000000;fontColor=#000000;"
GREY = "strokeColor=#B3B3B3;"
HEAD = "whiteSpace=wrap;html=1;fontStyle=1;fontSize=13;fillColor=#FFFFFF;" + BLACK
NOTE = ("rounded=1;whiteSpace=wrap;html=1;fontStyle=2;fontSize=10;fillColor=#FFFFFF;"
        + BLACK)
MSG = ("html=1;endArrow=open;endFill=0;rounded=0;fontSize=9;verticalAlign=bottom;"
       "labelBackgroundColor=none;strokeWidth=1;" + "strokeColor=#666666;fontColor=#000000;")
RET = MSG + "dashed=1;"
LIFE = "html=1;endArrow=none;dashed=1;rounded=0;" + GREY

# ── Participants (lifeline x) ──
TEACHER, SYSTEM, READER, REVIEWER = 240, 530, 830, 1120
vertex("Teacher", TEACHER - 52, 77, 104, 66, HEAD)
vertex("System", SYSTEM - 48, 77, 96, 60, HEAD)
vertex("Certificate Reader (OCR)", READER - 66, 74, 132, 64, "ellipse;" + HEAD)
vertex("Principal / Registrar", REVIEWER - 90, 65, 180, 72, HEAD)

TOP, BOTTOM = 145, 770
for x in (TEACHER, SYSTEM, READER, REVIEWER):
    line(x, TOP, x, BOTTOM, LIFE)

# ── Frame ──
vertex("", 145, 180, 1160, 580, "rounded=0;whiteSpace=wrap;html=1;fillColor=none;" + GREY)
vertex("2. Certificate Validation", 157, 190, 260, 22,
       "text;html=1;fontStyle=1;fontSize=14;align=left;verticalAlign=middle;"
       "strokeColor=none;fillColor=none;fontColor=#000000;")

# ── Messages & activities (top to bottom) ──
y = 228
step = 0


def msg(src, dst, text, ret=False, gap=34):
    global y, step
    step += 1
    line(src, y, dst, y, RET if ret else MSG, f"{step}: {text}")
    y += gap


def note(at, text, w=180, gap=52):
    global y
    vertex(text, at - w / 2, y - 8, w, 36, NOTE)
    y += gap


msg(TEACHER, SYSTEM, "Upload certificate (PDF / photo)")
note(SYSTEM, "Check file type &amp; size")
msg(SYSTEM, READER, "Send file for reading")
note(READER, "Extract text (PDF text / OCR)", w=200)
msg(READER, SYSTEM, "Return extracted text", ret=True)
note(SYSTEM, "Match title &amp; issuer, run checks", w=200)
msg(SYSTEM, TEACHER, "Show title, issuer &amp; check results", ret=True)
msg(TEACHER, SYSTEM, "Confirm certification type")
note(SYSTEM, "Save as pending review")
msg(SYSTEM, REVIEWER, "Certificate ready for review", ret=True)
msg(REVIEWER, SYSTEM, "Verify / reject with note")
note(SYSTEM, "Update credibility + log audit", w=200)
msg(SYSTEM, TEACHER, "Review result (verified / rejected)", ret=True)

body = "\n        ".join(cells)
XML = ('<mxfile host="app.diagrams.net" type="device">\n'
       '  <diagram id="certificate-sequence" name="Certificate Validation (Sequence)">\n'
       '    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
       'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1400" pageHeight="820" '
       'math="0" shadow="0">\n'
       '      <root>\n'
       f'        {body}\n'
       '      </root>\n'
       '    </mxGraphModel>\n'
       '  </diagram>\n'
       '</mxfile>\n')

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "certificate_validation_sequence.drawio"), "w",
              encoding="utf-8") as f:
        f.write(XML)
    print(f"wrote certificate_validation_sequence.drawio (last message at y={y})")
