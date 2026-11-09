import { PrintData } from './data';
import { _paragraphs, _buildParticipants, _activityMatrixRows, _execRows, _twgSection, _budgetSection, DEFAULT_MONITORING } from './sections';

/** Sections I-VIII and the signature block. */
export function proposalPages(p: PrintData): string {
  return `
<!-- ╔══════════════════════════════╗
     ║  I. PROPOSAL BRIEF          ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">I.&nbsp;&nbsp;Proposal Brief</div>
  <table class="brief-table">
    <tr>
      <td class="lbl">a. Title</td><td class="colon">:</td>
      <td>${p.titleHtml}</td>
    </tr>
    <tr>
      <td class="lbl">b. Nature of Activity</td><td class="colon">:</td>
      <td>
        <span class="cb"><span class="cb-box">${p.isCurricular ? '&#10003;' : '&nbsp;'}</span>Curricular</span>
        <span class="cb"><span class="cb-box">${p.isCoCurricular ? '&#10003;' : '&nbsp;'}</span>Co-curricular</span>
        <span class="cb"><span class="cb-box">${p.isExtraCurricular ? '&#10003;' : '&nbsp;'}</span>Extra-curricular</span>
      </td>
    </tr>
    <tr>
      <td class="lbl">c. Target Date</td><td class="colon">:</td>
      <td>${p.targetDate}</td>
    </tr>
    <tr>
      <td class="lbl">d. Proposed Venue</td><td class="colon">:</td>
      <td>${p.venueHtml}</td>
    </tr>
    <tr>
      <td class="lbl">e. Target Participants</td><td class="colon">:</td><td></td>
    </tr>
    <tr><td colspan="3" class="brief-block">${_buildParticipants(p.event['participants'])}</td></tr>
    <tr>
      <td class="lbl">f. Expected Outputs</td><td class="colon">:</td><td></td>
    </tr>
    <tr><td colspan="3" class="brief-block">${p.outputsHtml}</td></tr>
    <tr class="brief-gap">
      <td class="lbl">g. Proposed Budget</td><td class="colon">:</td>
      <td><strong>${p.budget}</strong></td>
    </tr>
    <tr>
      <td class="lbl">h. Source of Fund</td><td class="colon">:</td>
      <td>${p.fundSrc}</td>
    </tr>
    <tr>
      <td class="lbl">h. Focal Person</td><td class="colon">:</td>
      <td>
        ${p.focalName}<br>
        <em>${p.focalRoleHtml}</em>
        ${p.focalCp ? '<br>CP# ' + p.focalCp : ''}
      </td>
    </tr>
  </table>
</div>

<!-- ╔══════════════════════════════╗
     ║  II. RATIONALE              ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">II.&nbsp;&nbsp;Rationale</div>
  ${p.rationaleHtml}
</div>

<!-- ╔══════════════════════════════╗
     ║  III. OBJECTIVES            ║
     ╚══════════════════════════════╝ -->
<div class="section avoid-break">
  <div class="section-title">III.&nbsp;&nbsp;Objectives</div>
  <p>This project aims to:</p>
  ${p.objectivesHtml}
</div>

<!-- ╔══════════════════════════════╗
     ║  IV. METHODOLOGY            ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">IV.&nbsp;&nbsp;Methodology</div>
  ${p.methodologyIntroHtml}
  <table class="phase-table">
    ${p.methodologyRows}
  </table>
</div>

<!-- ╔══════════════════════════════╗
     ║  V. ACTIVITY MATRIX         ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">V.&nbsp;&nbsp;Activity Matrix</div>
  <table class="matrix-table">
    <thead>
      <tr>
        <th style="width:115px;">Day</th>
        <th style="width:110px;">Time</th>
        <th>Event</th>
        <th>Speaker</th>
      </tr>
    </thead>
    <tbody>
      ${_activityMatrixRows(p.event['activity_matrix'])}
    </tbody>
  </table>
</div>

<!-- ╔══════════════════════════════╗
     ║  VI. WORKING COMMITTEE      ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">VI.&nbsp;&nbsp;Working Committee</div>
  <div class="sub-title">a. Executive Committee</div>
  <table class="cmt-table" style="margin-bottom:14px;">
    <tbody>
      ${_execRows(p.event['exec_committee'], p.creatorName, p.focalName, p.focalRole)}
    </tbody>
  </table>
  <div class="sub-title">b. Technical Working Group</div>
  ${_twgSection(p.event['twg_groups'])}
</div>

<!-- ╔══════════════════════════════╗
     ║  VII. PROPOSED BUDGET       ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">VII.&nbsp;&nbsp;Proposed Budget</div>
  <p>The budget for this training shall be charged against
     ${p.fundSrc || 'School Fund'}
     subject to the usual accounting and auditing rules and regulations.
     This program adheres to the <strong>NO COLLECTION POLICY</strong> of DepEd.</p>
  ${_budgetSection(p.event['training_materials'], p.event['snacks'], p.budget)}
</div>

<!-- ╔══════════════════════════════╗
     ║  VIII. MONITORING & EVAL    ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">VIII.&nbsp;&nbsp;Monitoring and Evaluation</div>
  ${p.monitoringHtml || _paragraphs(DEFAULT_MONITORING)}
</div>

<!-- ╔══════════════════════════════╗
     ║  SIGNATURE BLOCK            ║
     ╚══════════════════════════════╝ -->
<div class="section keep" style="margin-top:22px;">
  <div class="sig-grid">
    <div>
      <div class="sig-lbl">Proponent:</div>
      <div class="sig-line">
        <div class="sig-name">${p.proponentName}</div>
        <div class="sig-title">${p.proponentTitle}</div>
      </div>
    </div>
    <div>
      <div class="sig-lbl">Noted:</div>
      <div class="sig-line">${p.sigBlock(0)}</div>
    </div>
    <div>
      <div class="sig-lbl">Endorsed:</div>
      <div class="sig-line">${p.sigBlock(1)}</div>
    </div>
    <div>
      <div class="sig-lbl">Recommending Approval:</div>
      <div class="sig-line">${p.sigBlock(2)}</div>
    </div>
  </div>
  <div class="sig-ctr">
    <div class="sig-lbl">Approved:</div><br>
    <div class="sig-line" style="display:inline-block;width:52%;text-align:center;">
      ${p.sigBlock(3)}
    </div>
  </div>
</div>

`;
}
