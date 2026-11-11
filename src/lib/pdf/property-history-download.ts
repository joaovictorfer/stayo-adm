import logo from '@/assets/stayo-logo-white.png.asset.json';
import bodyFont from '@/assets/payout-figtree.ttf.asset.json';
import headingFont from '@/assets/payout-outfit.ttf.asset.json';
import { printPalette } from './payout-download';
import { generateHistoryPdf, type HistoryPdfInput } from './property-history-pdf';
export async function downloadHistoryPdf(input: Omit<HistoryPdfInput, 'palette' | 'assets'>) {
  const load = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error('Não foi possível carregar a identidade visual do PDF.'); return new Uint8Array(await r.arrayBuffer()); };
  const [image, body, heading] = await Promise.all([load(logo.url), load(bodyFont.url), load(headingFont.url)]);
  const bytes = await generateHistoryPdf({ ...input, palette: printPalette(), assets: { logo: image, bodyFont: body, headingFont: heading } });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = `STAYO-Historico-${input.property.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}