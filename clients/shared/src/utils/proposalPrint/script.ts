/**
 * In-page script: lays #flow out onto fixed A4 sheets (.page) with the footer
 * template on each, then "Download" renders those sheets to a PDF via html2pdf.
 */
export function printScript(fileSafeTitle: string): string {
  return `
var DOC_FILENAME = '${fileSafeTitle}.pdf';

(function () {
  var SPLIT = { DIV: 1, SECTION: 1, TABLE: 1, TBODY: 1, UL: 1, OL: 1 };
  var HEADING = '.section-title, .sub-title, .bgt-sub, .cmt-title';
  var pages, body, placed;

  function el(cls) { var d = document.createElement('div'); d.className = cls; return d; }

  function newPage() {
    var pg = el('page');
    body = el('page-body');
    pg.appendChild(body);
    pg.appendChild(document.getElementById('footer-tpl').content.cloneNode(true));
    pages.appendChild(pg);
    placed = false;
  }

  function overflows() { return body.scrollHeight > body.clientHeight + 1; }

  // Block containers holding only block children can be split across sheets.
  function splittable(node) {
    if (!SPLIT[node.tagName] || !node.children.length) return false;
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType === 3 && c.textContent.trim()) return false;
      if (c.nodeType === 1 && /^inline/.test(getComputedStyle(c).display)) return false;
    }
    return true;
  }

  // Empty shells left behind when content moves on (a lone thead counts as empty).
  function hollow(e) {
    for (var i = 0; i < e.childNodes.length; i++) {
      var c = e.childNodes[i];
      if (c.nodeType === 3 && c.textContent.trim()) return false;
      if (c.nodeType === 1 && c.tagName !== 'THEAD') return false;
    }
    return true;
  }
  function prune(e) {
    while (e && e !== body && hollow(e)) { var p = e.parentNode; p.removeChild(e); e = p; }
  }

  // Rebuild the ancestors of the next node on a fresh sheet (tables repeat their header).
  function chain(path) {
    var c = body;
    for (var i = 0; i < path.length; i++) {
      var s = path[i].cloneNode(false);
      if (path[i].tagName === 'TABLE' && path[i].tHead) s.appendChild(path[i].tHead.cloneNode(true));
      c.appendChild(s);
      c = s;
    }
    return c;
  }

  function place(node, path, box) {
    if (node.nodeType !== 1) { box.appendChild(node.cloneNode(true)); return box; }
    if (node.classList.contains('page-break')) {
      if (placed) { prune(box); newPage(); return chain(path); }
      return box;
    }
    var copy = node.cloneNode(true);
    box.appendChild(copy);
    if (!overflows()) { placed = true; return box; }
    box.removeChild(copy);

    var keep = node.matches('.keep, .avoid-break');
    if (splittable(node) && !(keep && placed)) {
      var shell = node.cloneNode(false);
      box.appendChild(shell);
      var inner = path.concat([node]), cur = shell;
      for (var i = 0; i < node.childNodes.length; i++) cur = place(node.childNodes[i], inner, cur);
      return cur.parentNode;
    }
    if (!placed) { box.appendChild(copy); placed = true; return box; } // larger than a sheet

    // Move to a new sheet, taking a heading that would be left stranded with it.
    var orphan = box.lastElementChild && box.lastElementChild.matches(HEADING) ? box.lastElementChild : null;
    if (orphan) box.removeChild(orphan);
    prune(box);
    newPage();
    var next = chain(path);
    if (orphan) next.appendChild(orphan);
    return place(node, path, next); // fresh sheet: fits, splits, or is simply too big
  }

  function paginate() {
    var flow = document.getElementById('flow');
    pages = document.getElementById('pages');
    document.body.classList.remove('paged');
    pages.innerHTML = '';
    newPage();
    var box = body;
    for (var i = 0; i < flow.childNodes.length; i++) box = place(flow.childNodes[i], [], box);
    var sheets = pages.querySelectorAll('.page');
    for (var n = 0; n < sheets.length; n++) {
      sheets[n].querySelector('.pg-no').textContent = n + 1;
      sheets[n].querySelector('.pg-total').textContent = sheets.length;
    }
    document.body.classList.add('paged');
  }

  window.addEventListener('load', function () {
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(paginate);
  });
})();

function downloadDoc() {
  if (typeof html2pdf === 'undefined') {
    alert('PDF generator could not be loaded (check your internet connection). '
        + 'Opening the print dialog instead \\u2014 choose "Save as PDF" as the destination.');
    window.print();
    return;
  }
  var btn = document.querySelector('.download-btn');
  var sheets = Array.prototype.slice.call(document.querySelectorAll('#pages .page'));
  if (btn) { btn.disabled = true; btn.innerHTML = 'Generating PDF\\u2026'; }
  document.body.classList.add('generating-pdf');
  function restore() {
    document.body.classList.remove('generating-pdf');
    if (btn) { btn.disabled = false; btn.innerHTML = '&#11015;&nbsp;Download'; }
  }
  var opt = {
    margin: 0,
    filename: DOC_FILENAME,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  // One canvas per sheet, so every PDF page is exactly one preview sheet.
  var worker = html2pdf().set(opt).from(sheets[0]).toPdf();
  sheets.slice(1).forEach(function (sheet) {
    worker = worker.get('pdf').then(function (pdf) { pdf.addPage(); })
      .from(sheet).toContainer().toCanvas().toPdf();
  });
  worker.save().then(restore).catch(function (err) {
    restore();
    alert('Could not generate PDF: ' + err);
  });
}
`;
}
