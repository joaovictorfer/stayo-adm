import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { computeStatement, competenceOf, type StatementReservation, type StatementExpense, type StatementTransfer } from "../payout-statement";

export interface PayoutPdfReservation extends StatementReservation {
  reservation_code: string | null; channel: string; guest_name: string; guest_cpf: string | null; checkout_date: string;
}
export interface PayoutPdfExpense extends StatementExpense { description: string; category: string }
export interface PayoutPdfTransfer extends StatementTransfer { paid_on: string; method: string }
export type PayoutPdfPalette = Record<"navy" | "cobalt" | "coral" | "gold" | "paper" | "ink" | "muted" | "border" | "soft" | "onSolid", [number, number, number]>;
export interface PayoutPdfInput {
  property: string; propertyCode: string; ownerName?: string | null; competence: string; adminFeePercent: number;
  reservations: PayoutPdfReservation[]; expenses: PayoutPdfExpense[]; transfers: PayoutPdfTransfer[];
  palette: PayoutPdfPalette; issuedAt?: Date;
  assets?: { logo: Uint8Array; bodyFont: Uint8Array; headingFont: Uint8Array; cover?: Uint8Array };
}
const money = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
const channels: Record<string, string> = { airbnb: "Airbnb", booking: "Booking", decolar: "Decolar", direta: "Reserva direta", outro: "Outro" };
const categories: Record<string, string> = { manutencao: "Manutenção", lavanderia: "Lavanderia", compras: "Compras / enxoval", limpeza: "Limpeza", taxas: "Taxas", outro: "Outro" };

/** Full CPF is only used in the locally downloaded administrative document. */
export function payoutPdfCpf(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "Não informado";
}
export function payoutPdfAmount(r: PayoutPdfReservation, key: string, cents: number) {
  return r.missing_amounts?.includes(key) ? "Não informado" : money(cents);
}
export function payoutPdfReadiness(input: Pick<PayoutPdfInput, "reservations" | "competence">) {
  return input.reservations.filter(r => competenceOf(r.checkin_date) === input.competence).every(r => (r.missing_amounts?.length ?? 0) === 0);
}
/** Divisão contratual por reserva: base = diárias líquidas (bruto − limpeza − taxa do canal). */
export function payoutPdfSplit(r: PayoutPdfReservation, adminFeePercent: number) {
  const base = Math.max(0, r.gross_cents - r.cleaning_cents - r.platform_fee_cents);
  const stayo = Math.round((base * adminFeePercent) / 100);
  return { base, stayo, owner: base - stayo };
}

/** Browser-safe renderer: no database, public link, upload or financial writes. */
export async function generatePayoutPdf(input: PayoutPdfInput): Promise<Uint8Array> {
  if (!payoutPdfReadiness(input)) throw new Error("Complete os valores ausentes antes de gerar o PDF.");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const body = await doc.embedFont(input.assets?.bodyFont ?? StandardFonts.Helvetica, { subset: true });
  const heading = await doc.embedFont(input.assets?.headingFont ?? StandardFonts.HelveticaBold, { subset: true });
  const logo = input.assets ? await doc.embedPng(input.assets.logo) : undefined;
  const colors = Object.fromEntries(Object.entries(input.palette).map(([k, v]) => [k, rgb(...v)])) as Record<keyof PayoutPdfPalette, ReturnType<typeof rgb>>;
  const issued = input.issuedAt ?? new Date();
  const monthLabel = new Date(`${input.competence}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const rows = input.reservations.filter(r => competenceOf(r.checkin_date) === input.competence);
  const expenses = input.expenses.filter(e => competenceOf(e.occurred_on) === input.competence);
  const transfers = input.transfers.filter(t => t.competence === input.competence);
  const s = computeStatement(input.competence, input.adminFeePercent, rows, expenses, transfers);
  const W = 595.28, H = 841.89, M = 27, CW = W - M * 2;
  let page: PDFPage = doc.addPage([W, H]);
  let y = 0;
  const wrap = (value: string, size: number, font: PDFFont, maxWidth: number) => {
    // Wrap instead of shrinking financial text or clipping long names.
    const words = value.split(/\s+/); const lines: string[] = []; let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) { line = next; continue; }
      if (line) { lines.push(line); line = ""; }
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let part = "";
        for (const char of word) {
          if (part && font.widthOfTextAtSize(part + char, size) > maxWidth) { lines.push(part); part = ""; }
          part += char;
        }
        line = part;
      } else line = word;
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (value: string, x: number, top: number, size = 10, font: PDFFont = body, color = colors.ink, maxWidth = CW) => {
    const lines = wrap(value, size, font, maxWidth);
    lines.forEach((l, i) => page.drawText(l, { x, y: H - top - size - i * (size + 4), size, font, color }));
    return lines.length * (size + 4);
  };
  const right = (value: string, top: number, size = 10, font = body, color = colors.ink) => text(value, W - M - font.widthOfTextAtSize(value, size), top, size, font, color);
  const rect = (x: number, top: number, width: number, height: number, color: ReturnType<typeof rgb>) => page.drawRectangle({ x, y: H - top - height, width, height, color });
  const header = (first: boolean) => {
    const context = `${input.property} · ${monthLabel}`;
    const headerHeight = Math.max(50, 24 + wrap(context, 12, heading, CW - 100).length * 16);
    rect(0, 0, W, headerHeight, colors.navy);
    if (logo) { const d = logo.scaleToFit(48, 34); page.drawImage(logo, { x: M, y: H - headerHeight / 2 - d.height / 2, width: d.width, height: d.height }); }
    text("RELATÓRIO DE REPASSE", M + 88, 11, 7.5, body, colors.onSolid, CW - 100);
    text(context, M + 88, 23, 12, heading, colors.onSolid, CW - 100);
    y = headerHeight + 14;
    if (first) {
      text("Relatório de repasse", M, y, 15, heading, colors.navy);
      rect(M, y + 21, 30, 2, colors.cobalt);
      y += 34;
    }
  };
  const newPage = () => { page = doc.addPage([W, H]); header(false); };
  const space = (height: number) => { if (y + height > H - 65) newPage(); };
  const section = (title: string) => {
    space(wrap(title, 16, heading, CW).length * 20 + 44);
    y += text(title, M, y, 16, heading, colors.navy) + 8;
    rect(M, y, 34, 2, colors.cobalt);
    page.drawLine({ start: { x: M + 42, y: H - y - 1 }, end: { x: W - M, y: H - y - 1 }, thickness: 0.5, color: colors.border });
    y += 14;
  };
  const line = (label: string, value: string, strong = false) => {
    const font = strong ? heading : body;
    const amountWidth = font.widthOfTextAtSize(value, 11);
    const labelWidth = CW - amountWidth - 42;
    const height = Math.max(32, wrap(label, 10, font, labelWidth).length * 14 + 16);
    space(height);
    if (strong) rect(M, y, CW, height, colors.soft);
    text(label, M + 12, y + 8, 10, font, strong ? colors.navy : colors.ink, labelWidth);
    text(value, W - M - 12 - amountWidth, y + 8, 11, font, strong ? colors.navy : colors.ink);
    page.drawLine({ start: { x: M, y: H - y - height }, end: { x: W - M, y: H - y - height }, thickness: 0.5, color: colors.border });
    y += height;
  };
  header(true);
  const statusLabel = s.status === "a_compensar" ? "SALDO A COMPENSAR PELO PROPRIETÁRIO" : s.status === "zerado" ? "SALDO DO MÊS ZERADO" : "VALOR LÍQUIDO A REPASSAR AO PROPRIETÁRIO";
  const pct = input.adminFeePercent;
  const rightAt = (value: string, edge: number, top: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) =>
    text(value, edge - font.widthOfTextAtSize(value, size), top, size, font, color);
  /** Compact bands share the same measured layout for both payout capabilities. */
  const table = (title: string, flow: "stayo" | "platform_auto") => {
    const selected = rows.filter(r => r.payout_flow === flow);
    if (!selected.length) return;
    space(110);
    const titleHeight = text(title, M, y, 11, heading, colors.navy, CW * 0.55);
    y += titleHeight + 4;
    right(`CONTRATO · STAYO ${pct}% / PROPRIETÁRIO ${100 - pct}%`, y, 7.5, body, colors.muted);
    y += 22;
    if (!selected.length) { y += text("Nenhuma reserva neste mês.", M, y, 10, body, colors.muted) + 18; return; }
    const stayoFlow = flow === "stayo";
    const firstEdge = M + 288, midEdge = M + 397, lastEdge = W - M - 10;
    const columns = stayoFlow
      ? [{ label: "VALOR TOTAL", edge: firstEdge }, { label: `STAYO · ${pct}%`, edge: midEdge }, { label: `PROPRIETÁRIO · ${100 - pct}%`, edge: lastEdge }]
      : [{ label: "VALOR TOTAL", edge: firstEdge }, { label: "PAGO DIRETO AO PROPRIETÁRIO", edge: lastEdge }];
    const labelW = 190;
    let sumFirst = 0, sumMid = 0, sumLast = 0;
    selected.forEach((r, i) => {
      const nameLines = wrap(r.guest_name, 11, heading, labelW).length;
      const cpfText = `CPF ${payoutPdfCpf(r.guest_cpf)} · ${date(r.checkin_date).slice(0, 5)}–${date(r.checkout_date).slice(0, 5)}`;
      const codeText = `${r.reservation_code || "Sem código"} · ${channels[r.channel] || "Outro"}`;
      const codeHeight = wrap(codeText, 8, heading, labelW).length * 12;
      const cpfLines = wrap(cpfText, 9, body, labelW).length;
      const height = Math.max(56, 18 + codeHeight + nameLines * 15 + cpfLines * 13);
      space(height + (i === selected.length - 1 ? 48 : 7));
      rect(M, y, CW, height, colors.soft);
      const channelColor = r.channel === "airbnb" ? colors.coral : r.channel === "direta" ? colors.gold : colors.cobalt;
      rect(M, y, 2.5, height, channelColor);
      text(codeText, M + 10, y + 8, 8, heading, channelColor, labelW);
      text(r.guest_name, M + 10, y + 8 + codeHeight, 11, heading, colors.navy, labelW);
      text(cpfText, M + 10, y + 8 + codeHeight + nameLines * 15, 9, body, colors.muted, labelW);
      columns.forEach(c => rightAt(c.label.replace("VALOR TOTAL", "Valor total").replace("PROPRIETÁRIO", "Proprietário"), c.edge, y + 13, 7.5, body, colors.muted));
      const split = payoutPdfSplit(r, pct);
      const cells = stayoFlow
        ? [{ v: money(split.base), edge: firstEdge, last: false }, { v: money(split.stayo), edge: midEdge, last: false }, { v: money(split.owner), edge: lastEdge, last: true }]
        : [{ v: money(r.gross_cents), edge: firstEdge, last: false }, { v: payoutPdfAmount(r, "owner_direct", r.owner_direct_cents), edge: lastEdge, last: true }];
      cells.forEach((c) => rightAt(c.v, c.edge, y + 28, 11.5, heading, c.last ? colors.cobalt : colors.navy));
      if (stayoFlow) { sumFirst += split.base; sumMid += split.stayo; sumLast += split.owner; }
      else { sumFirst += r.gross_cents; sumLast += r.owner_direct_cents; }
      y += height + 7;
    });
    space(52);
    rect(M, y, CW, 38, colors.navy);
    text("TOTAL DO MÊS", M + 12, y + 9, 9, heading, colors.onSolid);
    text(`${selected.length} ${selected.length === 1 ? "reserva" : "reservas"}`, M + 12, y + 22, 8, body, colors.onSolid);
    const totals = stayoFlow
      ? [{ l: "Valor total", v: sumFirst, edge: firstEdge }, { l: `STAYO · ${pct}%`, v: sumMid, edge: midEdge }, { l: `Proprietário · ${100 - pct}%`, v: sumLast, edge: lastEdge }]
      : [{ l: "Valor total", v: sumFirst, edge: firstEdge }, { l: "Pago direto", v: sumLast, edge: lastEdge }];
    totals.forEach((t) => {
      rightAt(t.l, t.edge, y + 8, 8, body, colors.onSolid);
      rightAt(money(t.v), t.edge, y + 20, 12, heading, colors.onSolid);
    });
    y += 54;
  };
  table("Reservas recebidas pela STAYO", "stayo");
  table("Repasse direto pela plataforma", "platform_auto");

  if (!rows.length) y += text("Nenhuma reserva neste mês.", M, y, 10, body, colors.muted) + 16;
  if (expenses.length) section("Despesas do mês");
  for (const e of expenses) {
    const label = `${date(e.occurred_on)} · ${categories[e.category] || "Outro"} · ${e.description}${e.charged_to_owner ? "" : " (por conta da STAYO)"}`;
    space(Math.ceil(body.widthOfTextAtSize(label, 10) / (CW - 160)) * 14 + 30);
    line(label, money(e.amount_cents));
  }
  if (transfers.length) { y += 15; section("Repasses realizados pela STAYO"); }
  for (const t of transfers) line(`${date(t.paid_on)} · ${t.method.toUpperCase()}`, money(t.amount_cents));
  y += 18;
  space(100);
  page.drawLine({ start: { x: M, y: H - y }, end: { x: W - M, y: H - y }, thickness: 0.5, color: colors.border });
  text(`Proprietário: ${input.ownerName || "Não informado"}`, M, y + 10, 9, heading, colors.navy);
  text(statusLabel, M, y + 30, 8, heading, colors.navy);
  right(money(Math.abs(s.balance)), y + 27, 16, heading, colors.cobalt);
  text(`Despesas: ${money(s.expenseTotal)} · Repasses realizados: ${money(s.transferred)}`, M, y + 54, 8, body, colors.muted);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: colors.border });
    text(`Emitido em ${issued.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, M, H - 34, 8, body, colors.muted);
    right(`Página ${i + 1} de ${pages.length}`, H - 34, 8, body, colors.muted);
  });
  doc.setTitle(`Relatório de repasse — ${input.property} — ${monthLabel}`);
  doc.setAuthor("STAYO Gramado"); doc.setCreationDate(issued);
  return doc.save();
}