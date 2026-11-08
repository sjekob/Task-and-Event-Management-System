import { PrintData } from './data';
import { letterhead } from './chrome';

/** Last page: the observation tool evaluators fill in. */
export function observationTool(p: PrintData): string {
  return `
<!-- ╔══════════════════════════════╗
     ║  PAGE 8 – OBSERVATION TOOL  ║
     ╚══════════════════════════════╝ -->
<div class="page-break"></div>
<div class="obs-page">
  ${letterhead(p)}

  <div style="text-align:center;margin:10px 0 10px;">
    <div class="section-title">OBSERVATION TOOL</div>
    <p style="text-indent:0;margin-top:6px;margin-bottom:2px;">${p.titleHtml}</p>
    ${p.targetDate ? '<p style="text-indent:0;margin:2px 0;">' + p.targetDate + '</p>' : ''}
  </div>

  <div style="margin:8px 0;font-size:10pt;">
    Name (Optional): ___________________________________ &nbsp;&nbsp; Grade &amp; Section: ____________________
  </div>

  <p style="margin:6px 0;font-size:10pt;"><strong>Directions:</strong> Please assess the effectiveness of the project/program
     according to the indicators below. Put a check (&#10003;) under the appropriate column.</p>

  <table class="obs-table">
    <thead>
      <tr>
        <th style="width:65%;">INDICATORS</th>
        <th style="width:11%;">Evident</th>
        <th style="width:13%;">Not Evident</th>
        <th style="width:11%;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${p.obsRows}
    </tbody>
  </table>

  <div style="margin-top:14px;font-size:10pt;">
    <strong>COMMENTS AND RECOMMENDATIONS:</strong><br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________
  </div>
</div>

`;
}
