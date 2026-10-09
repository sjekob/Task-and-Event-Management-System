"""Generates tasknet_deployment.drawio — a simple UML deployment diagram of
TaskNet: client devices, the web server hosting the Flutter app, the
application server (Docker) running the API gateway and services, and the
database server.

Run: python docs/build_deployment_diagram.py
"""
import html
import os

STROKE = "#67AB9F"
FILL = "#F3FBF8"
NODE = (f"shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;"
        f"darkOpacity2=0.1;size=12;verticalAlign=top;fontStyle=1;fontSize=11;"
        f"fillColor={FILL};strokeColor={STROKE};strokeWidth=2;")
BOX = (f"rounded=0;whiteSpace=wrap;html=1;fontSize=10;fillColor={FILL};"
       f"strokeColor={STROKE};strokeWidth=2;")
COMPONENT = (f"html=1;whiteSpace=wrap;fontSize=10;fillColor={FILL};strokeColor={STROKE};"
             f"strokeWidth=2;")
LINE = "endArrow=none;html=1;fontSize=10;strokeColor=#555555;labelBackgroundColor=#ffffff;"

cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']


def esc(s):
    return html.escape(s, quote=True)


def vertex(cid, value, x, y, w, h, style):
    cells.append(f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="1">'
                 f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


def component(cid, label, x, y, w=170, h=44):
    """A box with the UML component icon in its corner."""
    vertex(cid, label, x, y, w, h, COMPONENT)
    vertex(cid + "_icon", "", x + w - 18, y + 5, 12, 14,
           f"shape=component;jettyWidth=4;jettyHeight=2;html=1;fillColor={FILL};"
           f"strokeColor={STROKE};")


def line(cid, src, tgt, label=""):
    cells.append(f'<mxCell id="{cid}" value="{esc(label)}" style="{LINE}" edge="1" parent="1" '
                 f'source="{src}" target="{tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>')


# Frame and title
vertex("frame", "", 20, 20, 1120, 600, "rounded=0;html=1;fillColor=none;strokeColor=#333333;")
vertex("title", "Deployment Diagram for TaskNet", 20, 32, 1120, 24,
       "text;html=1;align=center;fontSize=15;")

# Clients
vertex("c1", "Principal / Registrar PC<br><span style='font-weight:normal'>(Web Browser)</span>",
       60, 110, 160, 60, BOX + "fontStyle=1;")
vertex("c2", "Teacher / Dean / Coordinator PC<br><span style='font-weight:normal'>(Web Browser)</span>",
       60, 270, 160, 60, BOX + "fontStyle=1;")
vertex("c3", "Mobile Device<br><span style='font-weight:normal'>(Web Browser)</span>",
       60, 430, 160, 60, BOX + "fontStyle=1;")

# Web server: hosts the Flutter web app
vertex("web", "Web Server", 300, 210, 210, 180, NODE)
component("web_app", "TaskNet Web App<br>(Flutter)", 320, 250)
component("web_eval", "Public Evaluation<br>Page", 320, 315)

# Application server: Docker host running the gateway and services
vertex("app", "Application Server (Docker)", 600, 90, 260, 480, NODE)
component("gw", "API Gateway<br>(FastAPI :8000)", 630, 130, 200, 44)
component("s_auth", "Auth &amp; Certificate Service<br>(OCR reader)", 630, 190, 200, 44)
component("s_pers", "Personnel Service", 630, 250, 200, 40)
component("s_task", "Task Service", 630, 305, 200, 40)
component("s_event", "Event Service", 630, 360, 200, 40)
component("s_appr", "Appraisal Service", 630, 415, 200, 40)
component("files", "File Storage (Docker volume)<br>certificates &amp; uploads", 630, 470, 200, 44)

# Database server
vertex("db", "Database Server<br>(PostgreSQL 16)", 920, 290, 200, 220, NODE)
component("db_main", "TaskNet Database<br>(tasknet)", 935, 345)
component("db_profile", "Personnel Profiling<br>Tables", 935, 400)
component("db_audit", "Audit Log", 935, 455, 170, 36)

# Configuration node
vertex("cfg", "Configuration (.env)<br><span style='font-weight:normal'>JWT secret key</span>",
       920, 110, 200, 60, BOX + "fontStyle=1;")

# Connections
line("l1", "c1", "web", "HTTP / HTTPS")
line("l2", "c2", "web", "HTTP / HTTPS")
line("l3", "c3", "web", "HTTP / HTTPS")
line("l4", "web", "app", "REST API (JSON + JWT)")
line("l5", "app", "db", "SQL / TCP 5432")
line("l6", "app", "cfg", "reads")

body = "\n        ".join(cells)
XML = ('<mxfile host="app.diagrams.net" type="device">\n'
       '  <diagram id="deployment" name="Deployment">\n'
       '    <mxGraphModel dx="1200" dy="700" grid="1" gridSize="10" guides="1" tooltips="1" '
       'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1170" pageHeight="650" '
       'math="0" shadow="0">\n'
       '      <root>\n'
       f'        {body}\n'
       '      </root>\n'
       '    </mxGraphModel>\n'
       '  </diagram>\n'
       '</mxfile>\n')

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "tasknet_deployment.drawio"), "w", encoding="utf-8") as f:
        f.write(XML)
    print("wrote tasknet_deployment.drawio")
