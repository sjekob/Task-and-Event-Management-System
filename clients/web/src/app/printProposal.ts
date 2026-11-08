import { Json, PerformanceSummary } from '@shared/models';
import { PrintAssets, proposalHtml } from '@shared/utils/proposalPrint';
import { performanceSummaryHtml } from '@shared/utils/performanceSummaryPrint';

let assets: Promise<PrintAssets> | null = null;

async function dataUri(path: string): Promise<string> {
  const blob = await (await fetch(path)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Logos as data URIs (the PDF footer generator needs embedded images). */
function loadAssets(): Promise<PrintAssets> {
  assets ??= Promise.all([
    dataUri('/images/logo.png'), dataUri('/images/kagawaran_seal.png'),
    dataUri('/images/deped_matatag.png'), dataUri('/images/bagong_pilipinas.png'),
  ]).then(([logo, kagawaran, matatag, bagong]) => ({ logo, kagawaran, matatag, bagong }));
  return assets;
}

/**
 * Opens the printable proposal (paged A4 preview with Print / Download)
 * in a new tab. Returns false if the popup was blocked.
 */
export async function printProposal(event: Json): Promise<boolean> {
  const win = window.open('', '_blank');
  if (!win) return false;
  try {
    const html = proposalHtml(event, await loadAssets());
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return true;
  } catch {
    win.close();
    return false;
  }
}

/**
 * Opens the Annual Faculty Performance Summary (A4 landscape) in a new tab and
 * shows the print dialog ("Save as PDF"). Returns false if the popup was
 * blocked; throws when the summary can't be generated.
 */
export async function printPerformanceSummary(load: () => Promise<PerformanceSummary>): Promise<boolean> {
  const win = window.open('', '_blank');
  if (!win) return false;
  try {
    const [data, a] = await Promise.all([load(), loadAssets()]);
    const url = URL.createObjectURL(new Blob([performanceSummaryHtml(data, a.kagawaran)], { type: 'text/html' }));
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return true;
  } catch (e) {
    win.close();
    throw e;
  }
}
