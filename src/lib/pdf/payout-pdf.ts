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
// Airbnb mark from Simple Icons (CC0), kept vector-sharp in the local PDF.
const airbnbPath = "M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z";

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

/** Presentation totals reuse the selected statement; receipts are never inferred from a contractual split. */
export function payoutPdfBalance(input: Pick<PayoutPdfInput, "competence" | "adminFeePercent" | "reservations" | "expenses" | "transfers">) {
  const rows = input.reservations.filter(r => competenceOf(r.checkin_date) === input.competence);
  const statement = computeStatement(input.competence, input.adminFeePercent, rows, input.expenses, input.transfers);
  const direct = rows.filter(r => r.payout_flow === "platform_auto");
  const received = (reservations: PayoutPdfReservation[]) => reservations.some(r => r.missing_amounts?.includes("owner_direct"))
    ? null : reservations.reduce((sum, r) => sum + r.owner_direct_cents, 0);
  const directReceived = received(direct);
  return {
    reservationCount: rows.length,
    totalReservations: rows.reduce((sum, r) => sum + payoutPdfSplit(r, input.adminFeePercent).base, 0),
    airbnbReceived: received(direct.filter(r => r.channel === "airbnb")),
    totalReceived: directReceived === null ? null : directReceived + statement.transferred,
    // Automatic flows are settled outside STAYO; use documented receipts, not an estimated contractual entitlement.
    totalOwner: directReceived === null ? null : statement.ownerShare + directReceived,
    otherDirectReceived: received(direct.filter(r => r.channel !== "airbnb")),
    hasOtherDirect: direct.some(r => r.channel !== "airbnb"),
    statement,
  };
}

/** Browser-safe renderer: no database, public link, upload or financial writes. */
export async function generatePayoutPdf(input: PayoutPdfInput): Promise<Uint8Array> {
  if (!payoutPdfReadiness(input)) throw new Error("Complete os valores ausentes antes de gerar o PDF.");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const body = await doc.embedFont(input.assets?.bodyFont ?? StandardFonts.Helvetica, { subset: true });
  const heading = await doc.embedFont(input.assets?.headingFont ?? StandardFonts.HelveticaBold, { subset: true });
  const logo = input.assets ? await doc.embedPng(input.assets.logo) : undefined;
  const coverBytes = input.assets?.cover;
  const cover = coverBytes ? (coverBytes[0] === 0x89 ? await doc.embedPng(coverBytes) : await doc.embedJpg(coverBytes)) : undefined;
  const colors = Object.fromEntries(Object.entries(input.palette).map(([k, v]) => [k, rgb(...v)])) as Record<keyof PayoutPdfPalette, ReturnType<typeof rgb>>;
  const issued = input.issuedAt ?? new Date();
  const monthLabel = new Date(`${input.competence}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const rows = input.reservations.filter(r => competenceOf(r.checkin_date) === input.competence);
  const expenses = input.expenses.filter(e => competenceOf(e.occurred_on) === input.competence);
  const transfers = input.transfers.filter(t => t.competence === input.competence);
  const balance = payoutPdfBalance(input);
  const s = balance.statement;
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
  const airbnbIcon = (x: number, top: number, size = 13) => page.drawSvgPath(airbnbPath, { x, y: H - top, scale: size / 24, color: colors.coral });
  const rounded = (x: number, top: number, width: number, height: number, color: ReturnType<typeof rgb>, radius = 5, elevated = false) => {
    const r = Math.min(radius, width / 2, height / 2), k = r * 0.55228475;
    const path = `M ${r} 0 L ${width - r} 0 C ${width - r + k} 0 ${width} ${r - k} ${width} ${r} L ${width} ${height - r} C ${width} ${height - r + k} ${width - r + k} ${height} ${width - r} ${height} L ${r} ${height} C ${r - k} ${height} 0 ${height - r + k} 0 ${height - r} L 0 ${r} C 0 ${r - k} ${r - k} 0 ${r} 0 Z`;
    if (elevated) page.drawSvgPath(path, { x, y: H - top - 3, color: colors.navy, opacity: 0.09 });
    page.drawSvgPath(path, { x, y: H - top, color });
  };
  const header = (first: boolean) => {
    // Title is the document's identity; property and month already appear below.
    const headerHeight = 58;
    rect(0, 0, W, headerHeight, colors.navy);
    if (logo) { const d = logo.scaleToFit(52, 38); page.drawImage(logo, { x: M, y: H - headerHeight / 2 - d.height / 2, width: d.width, height: d.height }); }
    text("RELATÓRIO DE REPASSE", M + 88, 17, 15, heading, colors.onSolid, CW - 100);
    rect(M + 88, 38, 44, 2, colors.gold);
    y = headerHeight + 14;
    if (first) {
      if (cover) {
        // Preserve the real photo's proportions; never crop away the room.
        const dimensions = cover.scaleToFit(112, 84);
        page.drawImage(cover, { x: W - M - dimensions.width, y: H - y - dimensions.height, width: dimensions.width, height: dimensions.height });
        text(input.property, M, y + 10, 17, heading, colors.navy, CW - 130);
        text(monthLabel, M, y + 36, 10, body, colors.muted, CW - 130);
        y += Math.max(74, dimensions.height) + 14;
      }
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
    if (strong) rounded(M, y, CW, height, colors.soft, 4);
    text(label, M + 12, y + 8, 10, font, strong ? colors.navy : colors.ink, labelWidth);
    text(value, W - M - 12 - amountWidth, y + 8, 11, font, strong ? colors.navy : colors.ink);
    if (!strong) page.drawLine({ start: { x: M + 12, y: H - y - height }, end: { x: W - M - 12, y: H - y - height }, thickness: 0.5, color: colors.border });
    y += height;
  };
  header(true);
  const statusLabel = s.status === "a_compensar" ? "SALDO A COMPENSAR PELO PROPRIETÁRIO" : s.status === "zerado" ? "SALDO DO MÊS ZERADO" : "FALTA REPASSAR AO PROPRIETÁRIO";
  const pct = input.adminFeePercent;
  const rightAt = (value: string, edge: number, top: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) =>
    text(value, edge - font.widthOfTextAtSize(value, size), top, size, font, color);
  /** Compact bands share the same measured layout for both payout capabilities. */
  const table = (title: string, flow: "stayo" | "platform_auto") => {
    const selected = rows.filter(r => r.payout_flow === flow);
    if (!selected.length) return;
    space(110);
    const titleHeight = text(title, M, y, 11, heading, colors.navy, CW * 0.55);
    right(`CONTRATO · STAYO ${pct}% / PROPRIETÁRIO ${100 - pct}%`, y + 2, 7, body, colors.muted);
    y += titleHeight + 12;
    const directFlow = flow === "platform_auto";
    const firstEdge = M + 288, midEdge = M + 397, lastEdge = W - M - 10;
    const columns = [{ label: "Valor total", edge: firstEdge }, { label: `STAYO · ${pct}%`, edge: midEdge }, { label: `Proprietário · ${100 - pct}%`, edge: lastEdge }];
    const labelW = 190;
    let sumFirst = 0, sumMid = 0, sumLast = 0;
    selected.forEach((r, i) => {
      const nameLines = wrap(r.guest_name, 11, heading, labelW).length;
      const cpfText = `CPF ${payoutPdfCpf(r.guest_cpf)} · ${date(r.checkin_date).slice(0, 5)}–${date(r.checkout_date).slice(0, 5)}`;
      const codeText = `${r.reservation_code || "Sem código"} · ${channels[r.channel] || "Outro"}`;
      const codeHeight = wrap(codeText, 8, heading, labelW - (r.channel === "airbnb" ? 16 : 0)).length * 12;
      const cpfLines = wrap(cpfText, 9, body, labelW).length;
      const height = Math.max(directFlow ? 88 : 56, 18 + codeHeight + nameLines * 15 + cpfLines * 13);
      space(height + (i === selected.length - 1 ? 48 : 7));
      rounded(M, y, CW, height, colors.soft, 5);
      const channelColor = r.channel === "airbnb" ? colors.coral : r.channel === "direta" ? colors.gold : colors.cobalt;
      rounded(M + 2, y + 9, 2.5, height - 18, channelColor, 1.25);
      if (r.channel === "airbnb") airbnbIcon(M + 10, y + 7, 11);
      text(codeText, M + (r.channel === "airbnb" ? 26 : 10), y + 8, 8, heading, channelColor, labelW - (r.channel === "airbnb" ? 16 : 0));
      text(r.guest_name, M + 10, y + 8 + codeHeight, 11, heading, colors.navy, labelW);
      text(cpfText, M + 10, y + 8 + codeHeight + nameLines * 15, 9, body, colors.muted, labelW);
      columns.forEach(c => text(c.label, c.edge - 72, y + 13, 7.5, body, colors.muted));
      const split = payoutPdfSplit(r, pct);
      const cells = [{ v: money(split.base), edge: firstEdge, last: false }, { v: money(split.stayo), edge: midEdge, last: false }, { v: money(split.owner), edge: lastEdge, last: true }];
      cells.forEach(c => text(c.v, c.edge - 72, y + 28, 11.5, heading, c.last ? colors.cobalt : colors.navy));
      if (directFlow) {
        const confirmed = !r.missing_amounts?.includes("owner_direct") && r.owner_direct_cents > 0;
        const markerX = M + 225, markerTop = y + height - 18;
        page.drawCircle({ x: markerX, y: H - markerTop - 4, size: 4.5, borderWidth: 0.8, borderColor: colors.cobalt, ...(confirmed ? { color: colors.cobalt } : {}) });
        if (confirmed) {
          page.drawLine({ start: { x: markerX - 2, y: H - markerTop - 4 }, end: { x: markerX - 0.5, y: H - markerTop - 5.5 }, thickness: 0.8, color: colors.onSolid });
          page.drawLine({ start: { x: markerX - 0.5, y: H - markerTop - 5.5 }, end: { x: markerX + 2.5, y: H - markerTop - 2.5 }, thickness: 0.8, color: colors.onSolid });
        }
        text(confirmed ? "Pago direto ao Prop." : "Recebimento direto", markerX + 10, markerTop, 7.5, body, colors.muted, 175);
      }
      sumFirst += split.base; sumMid += split.stayo; sumLast += split.owner;
      y += height + 7;
    });
    space(52);
    rounded(M + 3, y, CW - 6, 38, colors.navy, 5, true);
    text("TOTAL DO MÊS", M + 12, y + 9, 9, heading, colors.onSolid);
    text(`${selected.length} ${selected.length === 1 ? "reserva" : "reservas"}`, M + 12, y + 22, 8, body, colors.onSolid);
    const totals = [{ l: "Valor total", v: sumFirst, edge: firstEdge }, { l: `STAYO · ${pct}%`, v: sumMid, edge: midEdge }, { l: `Proprietário · ${100 - pct}%`, v: sumLast, edge: lastEdge }];
    totals.forEach(t => {
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
  y += 6;
  const ownerLabel = `Proprietário: ${input.ownerName || "Não informado"}`;
  const ownerHeight = wrap(ownerLabel, 9, heading, CW).length * 13;
  // Keep the entire closing statement together, including long identities and extra channels.
  const balanceTitleHeight = wrap("Balancete do mês", 16, heading, CW).length * 20 + 22;
  space(balanceTitleHeight + ownerHeight + 338 + (balance.hasOtherDirect ? 32 : 0) + (s.transferred ? 32 : 0));
  section("Balancete do mês");
  y += text(ownerLabel, M, y, 9, heading, colors.navy) + 6;
  rounded(M, y, CW, 48, colors.soft, 6);
  text("Total do proprietário no mês", M + 12, y + 8, 10, heading, colors.navy);
  text(`${balance.reservationCount} ${balance.reservationCount === 1 ? "reserva" : "reservas"} · ${monthLabel}`, M + 12, y + 26, 8, body, colors.muted);
  rightAt(balance.totalOwner === null ? "Não informado" : money(balance.totalOwner), W - M - 12, y + 13, 17, heading, colors.navy);
  y += 64;

  const summaryWidth = (CW - 12) / 2;
  const saldoX = M + summaryWidth + 12;
  rounded(M, y, summaryWidth, 67, colors.soft, 6);
  rounded(saldoX, y, summaryWidth, 67, colors.cobalt, 6, true);
  airbnbIcon(M + 12, y + 12, 14);
  text("Airbnb · pago direto ao Prop.", M + 34, y + 12, 9, body, colors.muted, summaryWidth - 46);
  text(balance.airbnbReceived === null ? "Não informado" : money(balance.airbnbReceived), M + 12, y + 34, 18, heading, colors.navy, summaryWidth - 24);
  text(s.status === "a_compensar" ? "Saldo a compensar" : "Saldo a repassar ao proprietário", saldoX + 12, y + 12, 9, heading, colors.onSolid, summaryWidth - 24);
  text(money(Math.abs(s.balance)), saldoX + 12, y + 34, 18, heading, colors.onSolid, summaryWidth - 24);
  y += 87;

  text("COMPOSIÇÃO DO REPASSE", M, y, 9, heading, colors.navy);
  y += 19;
  line("(+) Total do proprietário nas reservas do mês", balance.totalOwner === null ? "Não informado" : money(balance.totalOwner), true);
  line("(−) Já repassado via Airbnb", balance.airbnbReceived === null ? "Não informado" : money(balance.airbnbReceived));
  if (balance.hasOtherDirect) line("(−) Já repassado por outras plataformas", balance.otherDirectReceived === null ? "Não informado" : money(balance.otherDirectReceived));
  line("(−) Despesas extraordinárias do proprietário", money(s.expenseTotal));
  if (s.transferred) line("(−) Já repassado pela STAYO", money(s.transferred));
  rounded(M + 3, y + 10, CW - 6, 54, colors.cobalt, 6, true);
  text(s.status === "a_repassar" ? "= VALOR A SER REPASSADO" : statusLabel, M + 15, y + 21, 10, heading, colors.onSolid, CW - 190);
  if (s.status === "a_repassar") text("Saldo a receber da STAYO", M + 15, y + 39, 8, body, colors.onSolid, CW - 190);
  rightAt(money(Math.abs(s.balance)), W - M - 15, y + 24, 20, heading, colors.onSolid);
  y += 72;
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