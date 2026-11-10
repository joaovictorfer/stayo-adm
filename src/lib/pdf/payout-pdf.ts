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
  let cover;
  if (input.assets?.cover) {
    const bytes = input.assets.cover;
    cover = bytes[0] === 0x89 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  }
  const colors = Object.fromEntries(Object.entries(input.palette).map(([k, v]) => [k, rgb(...v)])) as Record<keyof PayoutPdfPalette, ReturnType<typeof rgb>>;
  const issued = input.issuedAt ?? new Date();
  const monthLabel = new Date(`${input.competence}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const rows = input.reservations.filter(r => competenceOf(r.checkin_date) === input.competence);
  const expenses = input.expenses.filter(e => competenceOf(e.occurred_on) === input.competence);
  const transfers = input.transfers.filter(t => t.competence === input.competence);
  const s = computeStatement(input.competence, input.adminFeePercent, rows, expenses, transfers);
  const W = 595.28, H = 841.89, M = 44, CW = W - M * 2;
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
    rect(0, 0, W, 68, colors.navy);
    if (logo) { const d = logo.scaleToFit(72, 40); page.drawImage(logo, { x: M, y: H - 54, width: d.width, height: d.height }); }
    right("Demonstrativo de repasse ao proprietário", 19, 9, body, colors.onSolid);
    right(`${input.propertyCode} · ${input.competence}`, 37, 10, heading, colors.onSolid);
    rect(0, 68, W, 2, colors.gold);
    y = 92;
    if (!first) { y += text(input.property, M, y, 14, heading) + 4; y += text(monthLabel, M, y, 10, body, colors.muted) + 18; }
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
  const titleWidth = cover ? 290 : CW - 20;
  const titleHeight = wrap(input.property, 23, heading, titleWidth).length * 27;
  const bannerHeight = Math.max(126, titleHeight + 74);
  rect(0, 86, W, bannerHeight, colors.navy);
  rect(M, 108, 3, bannerHeight - 42, colors.cobalt);
  text("RELATÓRIO MENSAL", M + 15, 105, 9, heading, colors.gold, titleWidth);
  text(input.property, M + 15, 125, 23, heading, colors.onSolid, titleWidth);
  text(monthLabel, M + 15, 137 + titleHeight, 12, body, colors.onSolid, titleWidth);
  if (cover) { const d = cover.scaleToFit(155, 105); page.drawImage(cover, { x: W - M - d.width, y: H - 208, width: d.width, height: d.height }); }
  y = 86 + bannerHeight + 20;
  y += text(`Proprietário: ${input.ownerName || "Não informado"}`, M, y, 11, heading) + 5;
  y += text(`Competência por check-in · ${rows.length} ${rows.length === 1 ? "reserva" : "reservas"}`, M, y, 10, body, colors.muted) + 20;
  const statusLabel = s.status === "a_compensar" ? "SALDO A COMPENSAR PELO PROPRIETÁRIO" : s.status === "zerado" ? "SALDO DO MÊS ZERADO" : "VALOR LÍQUIDO A REPASSAR AO PROPRIETÁRIO";
  const gap = 8, col = (CW - gap * 3) / 4;
  const metrics: [string, string, typeof colors.navy, typeof colors.ink][] = [
    ["RESERVAS DO MÊS", String(rows.length), colors.navy, colors.onSolid],
    ["RECEBIDO PELA STAYO", money(s.stayoGross), colors.soft, colors.navy],
    ["PAGO PELA PLATAFORMA", money(s.autoOwnerDirect), colors.paper, colors.navy],
    [s.status === "a_compensar" ? "SALDO A COMPENSAR" : s.status === "zerado" ? "SALDO ZERADO" : "SALDO A REPASSAR", money(Math.abs(s.balance)), colors.cobalt, colors.onSolid],
  ];
  space(92);
  metrics.forEach(([label, value, fill, ink], i) => {
    const x = M + i * (col + gap);
    page.drawRectangle({ x, y: H - y - 76, width: col, height: 76, color: fill, borderColor: i === 2 ? colors.border : fill, borderWidth: 0.5 });
    text(label, x + 10, y + 10, 8, heading, ink, col - 20);
    text(value, x + 10, y + 44, 13, heading, ink, col - 20);
  });
  y += 94;
  space(122);
  rect(M, y, CW, 100, colors.cobalt); rect(M, y, 5, 100, colors.gold);
  text(statusLabel, M + 17, y + 15, 10, heading, colors.onSolid);
  text(money(Math.abs(s.balance)), M + 17, y + 35, 29, heading, colors.onSolid);
  text(s.status === "a_repassar" ? "Repasse STAYO até o dia 10 do mês seguinte" : s.status === "zerado" ? "Nenhum valor pendente pela STAYO" : "Compensação conforme os lançamentos do mês", M + 17, y + 77, 9, body, colors.onSolid);
  y += 122;
  section("Resumo do fechamento");
  line("Parte do proprietário nas reservas STAYO", money(s.ownerShare));
  line("(–) Despesas do proprietário", money(s.expenseTotal));
  line("(–) Repasses já realizados", money(s.transferred));
  line(s.status === "a_compensar" ? "Saldo a compensar" : "Saldo a repassar", money(Math.abs(s.balance)), true);
  y += 12;
  space(42);
  text("Reservas com repasse direto pela plataforma são informativas e não integram o saldo de repasse da STAYO.", M, y, 9, body, colors.muted);

  newPage();
  const pct = input.adminFeePercent;
  const baseOf = (r: PayoutPdfReservation) => Math.max(0, r.gross_cents - r.cleaning_cents - r.platform_fee_cents);
  const stayoShareOf = (r: PayoutPdfReservation) => Math.round((baseOf(r) * pct) / 100);
  const rightAt = (value: string, edge: number, top: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) =>
    text(value, edge - font.widthOfTextAtSize(value, size), top, size, font, color);
  /** Tabela executiva compacta: valor total e divisão contratual por reserva, sem detalhar limpeza. */
  const table = (title: string, flow: "stayo" | "platform_auto") => {
    const selected = rows.filter(r => r.payout_flow === flow);
    if (selected.length) space(150);
    section(title);
    if (!selected.length) { y += text("Nenhuma reserva neste mês.", M, y, 10, body, colors.muted) + 18; return; }
    const stayoFlow = flow === "stayo";
    const edges = stayoFlow ? [M + 282, M + 387, W - M] : [M + 282, W - M];
    const headers = stayoFlow ? ["VALOR TOTAL", `STAYO · ${pct}%`, `PROPRIETÁRIO · ${100 - pct}%`] : ["VALOR TOTAL", "PAGO DIRETO AO PROPRIETÁRIO"];
    const labelW = edges[0] - 105 - M - 14;
    space(20);
    text("RESERVA / HÓSPEDE", M + 12, y, 8, heading, colors.muted);
    headers.forEach((l, i) => rightAt(l, edges[i], y, 8, heading, colors.muted));
    y += 16;
    const sums = headers.map(() => 0);
    selected.forEach((r, i) => {
      const nameLines = wrap(r.guest_name, 11, heading, labelW).length;
      const height = 42 + nameLines * 14;
      space(height);
      if (i % 2 === 0) rect(M, y, CW, height, colors.soft);
      const channelColor = r.channel === "airbnb" ? colors.coral : r.channel === "direta" ? colors.gold : colors.cobalt;
      text(`${r.reservation_code || "Sem código"} · ${channels[r.channel] || "Outro"}`, M + 12, y + 9, 9, heading, channelColor, labelW);
      text(r.guest_name, M + 12, y + 24, 11, heading, colors.ink, labelW);
      text(`CPF ${payoutPdfCpf(r.guest_cpf)} · ${date(r.checkin_date)}–${date(r.checkout_date)}`, M + 12, y + 26 + nameLines * 14, 9, body, colors.muted, labelW);
      const values = stayoFlow
        ? [money(baseOf(r)), money(stayoShareOf(r)), money(baseOf(r) - stayoShareOf(r))]
        : [money(r.gross_cents), payoutPdfAmount(r, "owner_direct", r.owner_direct_cents)];
      values.forEach((v, vi) => rightAt(v, edges[vi], y + 21, 11.5, heading, vi === values.length - 1 ? colors.cobalt : colors.ink));
      if (stayoFlow) { sums[0] += baseOf(r); sums[1] += stayoShareOf(r); sums[2] += baseOf(r) - stayoShareOf(r); }
      else { sums[0] += r.gross_cents; sums[1] += r.owner_direct_cents; }
      y += height;
    });
    space(52);
    rect(M, y, CW, 50, colors.navy);
    text("TOTAL DO MÊS", M + 12, y + 9, 9, heading, colors.onSolid);
    text(`${selected.length} ${selected.length === 1 ? "reserva" : "reservas"}`, M + 12, y + 27, 10, body, colors.onSolid);
    const totalLabels = stayoFlow ? ["Valor total", `STAYO · ${pct}%`, `Proprietário · ${100 - pct}%`] : ["Valor total", "Pago direto"];
    totalLabels.forEach((l, i) => {
      rightAt(l, edges[i], y + 8, 8, body, colors.onSolid);
      rightAt(money(sums[i]), edges[i], y + 24, 12, heading, colors.onSolid);
    });
    y += 66;
  };
  table("Reservas recebidas pela STAYO", "stayo");
  table("Repasse direto pela plataforma", "platform_auto");

  newPage();
  section("Composição financeira do mês");
  line("Total recebido pela STAYO", money(s.stayoGross), true);
  line("(–) Taxas dos canais", money(s.platformFees));
  line("(–) Taxas de limpeza", money(s.cleaning));
  line("Base de administração (diárias líquidas)", money(Math.max(0, s.stayoGross - s.platformFees - s.cleaning)));
  line(`(–) Administração STAYO (${input.adminFeePercent}%)`, money(s.adminFee));
  line("Parte do proprietário", money(s.ownerShare), true);
  y += 20;
  section("Despesas do mês");
  if (!expenses.length) y += text("Nenhuma despesa lançada neste mês.", M, y, 10, body, colors.muted) + 16;
  for (const e of expenses) {
    const label = `${date(e.occurred_on)} · ${categories[e.category] || "Outro"} · ${e.description}${e.charged_to_owner ? "" : " (por conta da STAYO)"}`;
    space(Math.ceil(body.widthOfTextAtSize(label, 10) / (CW - 160)) * 14 + 30);
    line(label, money(e.amount_cents));
  }
  y += 15;
  section("Repasses realizados pela STAYO");
  if (!transfers.length) y += text("Nenhum repasse registrado nesta competência.", M, y, 10, body, colors.muted) + 16;
  for (const t of transfers) line(`${date(t.paid_on)} · ${t.method.toUpperCase()}`, money(t.amount_cents));
  y += 18;
  space(110);
  rect(M, y, CW, 100, colors.cobalt); rect(M, y, 5, 100, colors.gold);
  text(statusLabel, M + 17, y + 15, 10, heading, colors.onSolid);
  text(money(Math.abs(s.balance)), M + 17, y + 37, 28, heading, colors.onSolid);
  text(`Despesas descontadas: ${money(s.expenseTotal)} · Repasses realizados: ${money(s.transferred)}`, M + 17, y + 77, 9, body, colors.onSolid);
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