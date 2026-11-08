import { Json } from '../../models';
import { PrintAssets } from './assets';
import { printData } from './data';
import { chrome } from './chrome';
import { proposalPages } from './pages';
import { observationTool } from './observation';

/**
 * Printable DepEd activity proposal (A4) for an event, as a standalone HTML
 * document. The web app opens it in a new tab (a paged A4 preview with Print / Download);
 * the mobile app hands it to the system print dialog.
 */
export function proposalHtml(event: Json, assets: PrintAssets): string {
  const p = printData(event, assets);
  return `${chrome(p)}
${proposalPages(p)}
${observationTool(p)}
</div>
</body>
</html>`;
}

export type { PrintAssets } from './assets';
