import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Json, PerformanceSummary } from '@shared/models';
import { performanceSummaryHtml } from '@shared/utils/performanceSummaryPrint';
import { PrintAssets, proposalHtml } from '@shared/utils/proposalPrint';
import { printHtml, shareHtmlAsPdf } from '../ui/files';

const MODULES = {
  logo: require('../../assets/images/logo.png'),
  kagawaran: require('../../assets/images/kagawaran_seal.png'),
  matatag: require('../../assets/images/deped_matatag.png'),
  bagong: require('../../assets/images/bagong_pilipinas.png'),
};

let cached: Promise<PrintAssets> | null = null;

/** The letterhead / footer images as data URIs, so the printed document needs no network. */
function assets(): Promise<PrintAssets> {
  cached ??= (async () => {
    const entries = await Promise.all(Object.entries(MODULES).map(async ([key, mod]) => {
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      return [key, await toDataUri(asset)] as const;
    }));
    return Object.fromEntries(entries) as unknown as PrintAssets;
  })();
  return cached;
}

async function toDataUri(asset: Asset): Promise<string> {
  const uri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  }
  return `data:image/png;base64,${await new File(uri).base64()}`;
}

/** Opens the system print sheet (or a preview tab on web) for an event's DepEd proposal. */
export async function printProposal(event: Json): Promise<boolean> {
  return printHtml(proposalHtml(event, await assets()));
}

/** Saves the proposal as a PDF through the share sheet (phones only). */
export async function shareProposal(event: Json) {
  await shareHtmlAsPdf(proposalHtml(event, await assets()), `Event Proposal – ${String(event.title ?? '')}`);
}

/** The Annual Faculty Performance Summary through the print sheet ("Save as PDF"). */
export async function printPerformanceSummary(data: PerformanceSummary): Promise<boolean> {
  return printHtml(performanceSummaryHtml(data, (await assets()).kagawaran));
}
