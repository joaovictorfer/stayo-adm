import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { historyStatuses } from '../property-history';
import { ownerHistorySummary, type OwnerHistoryRow } from './property-history-report';
import type { PayoutPdfPalette } from './payout-pdf';

export interface HistoryPdfInput { property: string; code: string; period: string; rows: OwnerHistoryRow[]; palette: PayoutPdfPalette; assets: { logo: Uint8Array; bodyFont: Uint8Array; headingFont: Uint8Array }; }
export async function generateHistoryPdf(input: HistoryPdfInput) {
  if (!input.rows.length) throw new Error('Selecione ao menos um registro.');
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  doc.setTitle(`Histórico do imóvel — ${input.property}`); doc.setAuthor('STAYO Gramado');
  const [body, heading, logo] = await Promise.all([doc.embedFont(input.assets.bodyFont, { subset: true }), doc.embedFont(input.assets.headingFont, { subset: true }), doc.embedPng(input.assets.logo)]);
  const c = (key: keyof PayoutPdfPalette) => { const v = input.palette[key] ?? input.palette.ink; return rgb(v[0], v[1], v[2]); };
  const W = 595.28, H = 841.89, M = 40, width = W - 2 * M;
  let page: PDFPage = doc.addPage([W, H]); let y = H;
  function wrap(value: string, font: PDFFont, size: number, maxWidth: number) {
    const lines: string[] = []; let line = '';
    for (const word of value.replace(/[\u0000-\u001f]/g, ' ').split(/\s+/)) {
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        if (line) { lines.push(line); line = ''; }
        let part = ''; for (const ch of word) { if (font.widthOfTextAtSize(part + ch, size) > maxWidth && part) { lines.push(part); part = ''; } part += ch; } line = part;
      } else if (line && font.widthOfTextAtSize(line + ' ' + word, size) > maxWidth) { lines.push(line); line = word; }
      else line = line ? line + ' ' + word : word;
    }
    if (line) lines.push(line); return lines;
  }
  function text(value: string, size = 10, bold = false, color: keyof PayoutPdfPalette = 'ink') {
    for (const line of wrap(value, bold ? heading : body, size, width)) {
      if (y < 65) newPage();
      page.drawText(line, { x: M, y, size, font: bold ? heading : body, color: c(color) }); y -= size + 5;
    }
  }
  function header() {
    page.drawRectangle({ x: 0, y: H - 91, width: W, height: 91, color: c('navy') });
    const d = logo.scaleToFit(70, 49); page.drawImage(logo, { x: M, y: H - 69, width: d.width, height: d.height });
    page.drawText('HISTÓRICO DO IMÓVEL', { x: M + 95, y: H - 43, size: 19, font: heading, color: c('onSolid') });
    page.drawText('Compras · entregas · conferências', { x: M + 95, y: H - 64, size: 10, font: body, color: c('onSolid') });
    y = H - 121; text(input.property, 17, true, 'navy'); text(`${input.code} · ${input.period}`, 9, false, 'muted'); y -= 10;
  }
  function newPage() { page = doc.addPage([W, H]); header(); }
  header();
  const summary = ownerHistorySummary(input.rows);
  text(`${summary.purchases} compras · ${summary.delivery} unidades a entregar · ${summary.checking} unidades a conferir`, 11, true, 'cobalt'); y -= 8;
  text('Situação mais recente dos registros incluídos', 9, false, 'muted');
  const latest = new Map<string, OwnerHistoryRow>();
  for (const r of input.rows) { const key = r.caseId ?? r.id; if (r.revision >= (latest.get(key)?.revision ?? -1)) latest.set(key, r); }
  const pending = [...latest.values()].filter(r => r.delivery || r.needsCheck);
  if (!pending.length) text('Sem entregas ou conferências pendentes nos registros incluídos.', 10);
  for (const r of pending) text(`${r.title}: ${r.delivery ? `${r.delivery} a entregar` : ''}${r.delivery && r.needsCheck ? ' · ' : ''}${r.checking ? `${r.checking} a conferir` : r.needsCheck ? 'conferência pendente' : ''}`, 10);
  y -= 10; text('ACOMPANHAMENTO CRONOLÓGICO', 11, true, 'navy'); y -= 6;
  for (const r of input.rows) {
    const titleLines = wrap(r.title, heading, 12, width);
    const details = `${r.day.split('-').reverse().join('/')}${r.time ? ` · ${r.time}` : ''} · ${r.category === 'compra' ? 'Compra / reposição' : 'Vistoria / conferência'} · ${r.phase === 'operacao' ? 'Operação' : 'Implantação'}`;
    const qty = r.category === 'compra' ? `Previsto: ${r.expected ?? 'Não informado'}   |   Recebido: ${r.received ?? 'Não informado'}   |   Conferido: ${r.checked ?? 'Não informado'}` : '';
    const status = historyStatuses[r.status as keyof typeof historyStatuses] ?? r.status;
    const lines = [details, `Status: ${status}`, ...(qty ? [qty] : []), ...(r.amount !== null ? [`Valor registrado: ${(r.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`] : [])];
    const height = titleLines.length * 17 + lines.reduce((n, line) => n + wrap(line, body, 10, width).length * 15, 0) + 24;
    if (y - height < 65) newPage();
    page.drawLine({ start: { x: M, y: y + 5 }, end: { x: W - M, y: y + 5 }, thickness: 0.6, color: c('border') }); y -= 13;
    text(r.title, 12, true, 'navy'); for (const line of lines) text(line, 10, false, 'muted'); y -= 12;
  }
  const pages = doc.getPages(); pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 43 }, end: { x: W - M, y: 43 }, thickness: 0.6, color: c('border') });
    p.drawText(`Emitido em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, { x: M, y: 28, size: 8, font: body, color: c('muted') });
    const label = `Página ${i + 1} de ${pages.length}`; p.drawText(label, { x: W - M - body.widthOfTextAtSize(label, 8), y: 28, size: 8, font: body, color: c('muted') });
  });
  return doc.save();
}