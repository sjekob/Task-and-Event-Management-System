import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateProposalHtml, proposalFileName, type EventRecord, type ProposalImages } from '@tasknet/shared';

const SOURCES = {
  logo: require('@/assets/print/logo.png'),
  kagawaran: require('@/assets/print/kagawaran_seal.png'),
  depedMatatag: require('@/assets/print/deped_matatag.png'),
  bagongPilipinas: require('@/assets/print/bagong_pilipinas.png'),
};

let images: Promise<ProposalImages> | null = null;

/** Printing HTML can't load bundled asset URLs (iOS), so the letterhead images are inlined as base64. */
async function dataUri(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (Platform.OS === 'web') return asset.uri;
  return `data:image/png;base64,${await new File(asset.localUri ?? asset.uri).base64()}`;
}

function loadImages(): Promise<ProposalImages> {
  images ??= Promise.all(Object.values(SOURCES).map(dataUri))
    .then(([logo, kagawaran, depedMatatag, bagongPilipinas]) => ({ logo, kagawaran, depedMatatag, bagongPilipinas }))
    .catch((e) => { images = null; throw e; });
  return images;
}

/** Renders the DepEd-format proposal to a PDF and opens the share sheet (save, print, send). */
export async function shareProposal(event: EventRecord) {
  const html = generateProposalHtml(event, { images: await loadImages() });
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: proposalFileName(event) });
  } else {
    await Print.printAsync({ uri });
  }
}
