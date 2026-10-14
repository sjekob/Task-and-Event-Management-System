import { generateProposalHtml, type EventRecord, type ProposalImages } from '@tasknet/shared';

let images: Promise<ProposalImages> | null = null;

async function dataUri(path: string): Promise<string> {
  const blob = await (await fetch(path)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Embedded as data URIs so the PDF download can draw them on every page. */
function loadImages(): Promise<ProposalImages> {
  images ??= Promise.all(['logo', 'kagawaran_seal', 'deped_matatag', 'bagong_pilipinas']
    .map((n) => dataUri(`/print/${n}.png`)))
    .then(([logo, kagawaran, depedMatatag, bagongPilipinas]) => ({ logo, kagawaran, depedMatatag, bagongPilipinas }));
  return images;
}

/**
 * Opens the DepEd-format proposal in a new tab, which shows the print dialog
 * ("Save as PDF") and a Download button. Returns false when popups are blocked.
 */
export async function printProposal(event: EventRecord): Promise<boolean> {
  // Open synchronously (inside the click) so popup blockers allow it.
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write('<p style="font-family:sans-serif;padding:24px">Preparing the proposal…</p>');
  const html = generateProposalHtml(event, { images: await loadImages(), withToolbar: true });
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
