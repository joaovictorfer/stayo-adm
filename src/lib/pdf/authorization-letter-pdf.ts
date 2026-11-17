import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import backgroundUrl from '@/assets/letters/contract-letterhead.pdf?url';
import regularAsset from '@/assets/letters/regular.ttf.asset.json';
import boldAsset from '@/assets/letters/bold.ttf.asset.json';
import { letterParagraphs, type AuthorizationLetterFields } from '../authorization-letter';

export async function generateAuthorizationLetterPdf(fields: AuthorizationLetterFields): Promise<Uint8Array> {
  const fetchBytes = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error('Não foi possível carregar o modelo da carta.'); return new Uint8Array(await response.arrayBuffer()); };
  const [background, regular, bold] = await Promise.all([fetchBytes(backgroundUrl), fetchBytes(regularAsset.url), fetchBytes(boldAsset.url)]);
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const [normalFont, boldFont] = await Promise.all([pdf.embedFont(regular), pdf.embedFont(bold)]);
  const source = await PDFDocument.load(background);
  const [paper] = await pdf.embedPages([source.getPage(0)]);
  if (!paper) throw new Error('Papel timbrado indisponível.');
  const width = paper.width, height = paper.height, left = 85.05, contentWidth = width - left * 2;
  let page = pdf.addPage([width, height]), y = height - 135;
  const addBackground = () => page.drawPage(paper, { x: 0, y: 0, width, height }); addBackground();
  const size = 11, lineHeight = 12.65;
  for (const paragraph of letterParagraphs(fields)) {
    const fullText = paragraph.runs.map(run => run.text).join('');
    const words = Array.from(fullText.matchAll(/\S+/g), match => {
      let offset = 0;
      const run = paragraph.runs.find(item => { offset += item.text.length; return offset > (match.index ?? 0); });
      return { text: match[0], font: run?.bold ? boldFont : normalFont };
    });
    const lines: Array<Array<{ text: string; font: PDFFont }>> = []; let line: typeof words = [], used = 0;
    for (const word of words) {
      const wordWidth = word.font.widthOfTextAtSize(word.text, size), gap = line.length ? normalFont.widthOfTextAtSize(' ', size) : 0;
      if (line.length && used + gap + wordWidth > contentWidth) { lines.push(line); line = []; used = 0; }
      line.push(word); used += (line.length > 1 ? normalFont.widthOfTextAtSize(' ', size) : 0) + wordWidth;
    }
    if (line.length) lines.push(line);
    const after = (paragraph.after ?? 240) / 20;
    if (y - lines.length * lineHeight - (paragraph.divider ? 30 : 0) < 70) { page = pdf.addPage([width, height]); addBackground(); y = height - 135; }
    lines.forEach((row, index) => {
      if (y < 70) { page = pdf.addPage([width, height]); addBackground(); y = height - 135; }
      const baseGap = normalFont.widthOfTextAtSize(' ', size);
      const textWidth = row.reduce((sum, word) => sum + word.font.widthOfTextAtSize(word.text, size), 0);
      const rowWidth = textWidth + Math.max(0, row.length - 1) * baseGap;
      const align = paragraph.align ?? 'both';
      let x = align === 'center' ? left + (contentWidth - rowWidth) / 2 : align === 'right' ? left + contentWidth - rowWidth : left;
      const gap = align === 'both' && index < lines.length - 1 && row.length > 1 ? (contentWidth - textWidth) / (row.length - 1) : baseGap;
      row.forEach(word => { page.drawText(word.text, { x, y, size, font: word.font, color: rgb(0, 0, 0) }); x += word.font.widthOfTextAtSize(word.text, size) + gap; });
      y -= lineHeight;
    });
    if (paragraph.divider) page.drawLine({ start: { x: left, y: y + 4 }, end: { x: left + contentWidth, y: y + 4 }, thickness: 0.5, color: rgb(0.66, 0.66, 0.66) });
    y -= after;
  }
  pdf.setTitle(`Carta de autorização à portaria – ${fields.condominium} ${fields.unit}`);
  pdf.setAuthor('STAYO Gramado');
  return pdf.save();
}