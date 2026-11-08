import { PrintData } from './data';
import { PRINT_CSS } from './styles';
import { printScript } from './script';

/** The DepEd letterhead (page 1 and the observation tool). */
export function letterhead(p: PrintData): string {
  return `<div class="doc-header">
  <img src="${p.assets.kagawaran}" class="seal" alt="Kagawaran ng Edukasyon Seal">
  <div class="rep">Republika ng Pilipinas</div>
  <div class="dept">Kagawaran ng Edukasyon</div>
  <div class="sub-hd">
    <span class="region">REHIYON V--BICOL</span><br>
    TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA<br>
    NAGA CENTRAL SCHOOL II<br>
    JACOB ST., PE&Ntilde;AFRANCIA, NAGA CITY
  </div>
</div>`;
}

/**
 * Document head, print bar and the footer template the paginator stamps on
 * every A4 sheet; then opens #flow (the unpaginated content) with the letterhead.
 */
export function chrome(p: PrintData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Event Proposal – ${p.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap" rel="stylesheet">
<style>
${PRINT_CSS}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
${printScript(p.fileSafeTitle)}
</script>
</head>
<body>

<div class="print-bar no-print">
  <span style="margin-right:8px;">Event Proposal — ${p.title}</span>
  <button class="print-btn" onclick="window.print()">&#128438;&nbsp;Print</button>
  <button class="download-btn" onclick="downloadDoc()">&#11015;&nbsp;Download</button>
</div>

<template id="footer-tpl">
  <div class="page-footer">
    <div class="pf-logos">
      <img src="${p.assets.matatag}" alt="DepEd MATATAG">
      <img src="${p.assets.bagong}" alt="Bagong Pilipinas">
      <img src="${p.assets.logo}" alt="NCS II Seal">
    </div>
    <div class="pf-info">
      <b>Telephone No.: (054) 881-3938</b><br>
      <b>Email Address:</b> 114501@deped.gov.ph
      <table class="pf-page"><tr><td>Page</td><td><span class="pg-no">1</span> of <span class="pg-total">1</span></td></tr></table>
    </div>
  </div>
</template>

<div id="pages"></div>
<div id="flow">
${letterhead(p)}

<div class="date-line">${p.dateDisplay || '&nbsp;'}</div>
`;
}
