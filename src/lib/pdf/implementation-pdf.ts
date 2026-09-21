/**
 * Fase 7 — PDFs operacionais da implantação: enxoval (completo ou só
 * faltantes), itens faltantes e resumo da implantação.
 *
 * Reaproveita o mesmo desenho/identidade do gerador de proposta
 * (src/lib/pdf/proposal-pdf.ts) e roda no navegador, a partir dos dados
 * já carregados na tela.
 *
 * REGRA DE PRIVACIDADE: estes documentos podem sair da Stayo (fornecedor,
 * equipe de campo, proprietário). Nunca incluem senha de Wi-Fi, senha de
 * fechadura, localização de chaves, documento ou selfie.
 */

import { PDFDocument, type PDFFont, StandardFonts, rgb } from "pdf-lib";

import logoAsset from "../../assets/stayo-logo-clara.png.asset.json";
import type { ImplementationItem, ImplementationProject } from "../../types/core";
import { itemStatusLabels, type ReadinessResult } from "../implementation-status";
import {
  supplyPriorityLabels,
  supplyStatusLabels,
  type SupplyItem,
  type SupplyModule,
} from "../../types/implementation-supply";

const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 48;
const NAVY = rgb(11 / 255, 49 / 255, 80 / 255);
const NAVY_LIGHT = rgb(18 / 255, 63 / 255, 104 / 255);
const FOREST = NAVY;
const WHITE = rgb(1, 1, 1);
const INK = rgb(23 / 255, 35 / 255, 47 / 255);
const INK_MUTED = rgb(107 / 255, 119 / 255, 133 / 255);
const BORDER = rgb(228 / 255, 232 / 255, 236 / 255);
const SOFT = rgb(245 / 255, 247 / 255, 249 / 255);
const DANGER = rgb(166 / 255, 45 / 255, 45 / 255);
const SUCCESS = rgb(29 / 255, 112 / 255, 74 / 255);
const WARNING = rgb(174 / 255, 103 / 255, 0);
const CHAMPAGNE = rgb(205 / 255, 173 / 255, 104 / 255);

/** pdf-lib com fontes padrão não suporta caracteres fora do Latin-1 (ex.: emoji). */
function safe(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/[^\u0000-\u00FF]/g, "");
}

/** Corta o texto para caber na largura útil da página (fonte de largura variável). */
function clamp(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 3)}...`;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = safe(value).split(/\n+/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = words[0] ?? "";
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Remove linhas de observação que possam conter segredos operacionais. */
export function safeOperationalNotes(notes: string | null): string | null {
  if (!notes?.trim()) return null;
  const sensitive = /\b(senha|password|wi[ -]?fi|fechadura|token|credencial|c[oó]digo de acesso|localiza[cç][aã]o da chave|chave do im[oó]vel)\b/i;
  const safeLines = notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !sensitive.test(line));
  return safeLines.length > 0 ? safeLines.join("\n") : null;
}

async function rasterUrlAsPng(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    let width = 0;
    let height = 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      width = bitmap.width;
      height = bitmap.height;
      canvas.width = width;
      canvas.height = height;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
    } else {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        width = image.naturalWidth;
        height = image.naturalHeight;
        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
    if (width === 0 || height === 0) return null;
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return pngBlob ? pngBlob.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function createDoc() {
  return PDFDocument.create();
}

interface Writer {
  text: (
    value: string,
    opts?: { size?: number; color?: ReturnType<typeof rgb>; font?: PDFFont; x?: number },
  ) => void;
  spacer: (h?: number) => void;
  rule: () => void;
  section: (title: string) => void;
  metric: (label: string, value: string, x: number, width: number, color?: ReturnType<typeof rgb>) => void;
  progress: (percent: number) => void;
  coverImage: (url: string) => Promise<void>;
  finish: () => Promise<Uint8Array>;
}

async function makeWriter(): Promise<{ writer: Writer; bold: PDFFont }> {
  const pdfDoc = await createDoc();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage(PAGE_SIZE);
      y = PAGE_SIZE[1] - MARGIN;
    }
  };

  const writer: Writer = {
    text: (value, opts = {}) => {
      const size = opts.size ?? 10;
      ensureSpace(size + 6);
      page.drawText(safe(value), {
        x: opts.x ?? MARGIN,
        y,
        size,
        font: opts.font ?? font,
        color: opts.color ?? INK,
      });
      y -= size + 6;
    },
    spacer: (h = 10) => {
      y -= h;
    },
    rule: () => {
      ensureSpace(12);
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_SIZE[0] - MARGIN, y },
        thickness: 0.75,
        color: BORDER,
      });
      y -= 14;
    },
    section: (title) => {
      ensureSpace(32);
      page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 18, color: NAVY_LIGHT });
      page.drawText(safe(title), { x: MARGIN + 11, y, size: 12, font: bold, color: NAVY });
      y -= 26;
    },
    metric: (label, value, x, width, color = NAVY) => {
      page.drawRectangle({ x, y: y - 48, width, height: 54, color: SOFT, borderColor: BORDER, borderWidth: 0.75 });
      page.drawText(safe(label.toUpperCase()), { x: x + 10, y: y - 10, size: 7.5, font: bold, color: INK_MUTED });
      page.drawText(safe(clamp(value, 24)), { x: x + 10, y: y - 31, size: 13, font: bold, color });
    },
    progress: (percent) => {
      const width = PAGE_SIZE[0] - MARGIN * 2;
      const safePercent = Math.max(0, Math.min(100, percent));
      page.drawRectangle({ x: MARGIN, y: y - 7, width, height: 7, color: BORDER });
      page.drawRectangle({ x: MARGIN, y: y - 7, width: width * (safePercent / 100), height: 7, color: NAVY_LIGHT });
      y -= 18;
    },
    coverImage: async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") ?? "";
        const image = contentType.includes("png") || url.toLowerCase().includes(".png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const width = PAGE_SIZE[0] - MARGIN * 2;
        const height = 150;
        const scale = Math.min(width / image.width, height / image.height);
        const drawnWidth = image.width * scale;
        const drawnHeight = image.height * scale;
        ensureSpace(height + 12);
        page.drawRectangle({ x: MARGIN, y: y - height, width, height, color: SOFT });
        page.drawImage(image, {
          x: MARGIN + (width - drawnWidth) / 2,
          y: y - height + (height - drawnHeight) / 2,
          width: drawnWidth,
          height: drawnHeight,
        });
        y -= height + 16;
      } catch {
        // A capa é complementar: falha de rede/formato nunca impede o PDF operacional.
      }
    },
    finish: () => pdfDoc.save(),
  };

  return { writer, bold };
}

function propertyLine(implementation: ImplementationProject): string {
  return (
    [implementation.nickname, implementation.condominiumName, implementation.unit]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

function header(
  writer: Writer,
  bold: PDFFont,
  implementation: ImplementationProject,
  title: string,
) {
  writer.text("STAYO", { size: 20, font: bold, color: FOREST });
  writer.spacer(4);
  writer.text(title, { size: 14, font: bold, color: INK });
  writer.spacer(8);
  writer.text(`Código: ${implementation.code}`, { size: 10, color: INK_MUTED });
  writer.text(`Imóvel: ${propertyLine(implementation)}`, { size: 10, color: INK_MUTED });
  writer.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, {
    size: 10,
    color: INK_MUTED,
  });
  writer.spacer(10);
  writer.rule();
}

export function missingQty(item: SupplyItem): number {
  return Math.max(0, item.requiredQty - item.existingQty);
}

export interface SuppliesPdfInput {
  implementation: ImplementationProject;
  items: SupplyItem[];
  module: SupplyModule;
  /** "faltantes" lista apenas o que ainda falta comprar. */
  scope: "completo" | "faltantes";
}

export async function generateSuppliesPdf(input: SuppliesPdfInput): Promise<Uint8Array> {
  const { implementation, module, scope } = input;
  const { writer, bold } = await makeWriter();

  const items = (scope === "faltantes"
    ? input.items.filter((i) => missingQty(i) > 0 && i.status !== "nao_aplicavel")
    : input.items
  ).sort((a, b) => a.displayOrder - b.displayOrder);

  const base = module === "enxoval" ? "Enxoval" : "Itens faltantes";
  const title = scope === "faltantes" ? `${base} — o que ainda falta` : `${base} — lista completa`;
  header(writer, bold, implementation, title);

  if (items.length === 0) {
    writer.text("Nenhum item nesta lista.", { size: 10, color: INK_MUTED });
    return writer.finish();
  }

  const byRoom = new Map<string, SupplyItem[]>();
  for (const item of items) {
    const room = item.room?.trim() || "Sem ambiente definido";
    byRoom.set(room, [...(byRoom.get(room) ?? []), item]);
  }

  let totalMissing = 0;

  for (const [room, roomItems] of byRoom) {
    writer.text(room, { size: 12, font: bold, color: FOREST });
    writer.spacer(2);
    for (const item of roomItems) {
      const missing = missingQty(item);
      totalMissing += missing;
      const main = [item.name, item.size ? `tam. ${item.size}` : null]
        .filter(Boolean)
        .join("  ·  ");
      writer.text(clamp(main, 70), { size: 9.5, font: bold });
      const details = [
        `necessário ${item.requiredQty}`,
        `existente ${item.existingQty}`,
        `falta ${missing}`,
        supplyStatusLabels[item.status],
        supplyPriorityLabels[item.priority].toLowerCase(),
        item.responsible ? `resp. ${clamp(item.responsible, 24)}` : null,
        item.blocksReadiness ? "BLOQUEIA PRONTIDAO" : null,
      ].filter(Boolean);
      writer.text(`   ${details.join("  ·  ")}`, { size: 9, color: INK_MUTED });
      if (item.notes?.trim()) {
        writer.text(`   ${clamp(item.notes.trim(), 95)}`, { size: 9, color: INK_MUTED });
      }
      writer.spacer(2);
    }
    writer.spacer(8);
  }

  writer.rule();
  writer.text(`Itens listados: ${items.length}  ·  Peças faltando: ${totalMissing}`, {
    size: 11,
    font: bold,
  });

  return writer.finish();
}

export interface ImplementationSummaryPdfInput {
  implementation: ImplementationProject;
  checklist: ImplementationItem[];
  supplies: SupplyItem[];
  progressPercent: number;
  readiness: ReadinessResult;
  blockers: string[];
  statusLabel: string;
  responsibleName?: string | null;
  coverImageUrl?: string | null;
}

export async function generateImplementationSummaryPdf(
  input: ImplementationSummaryPdfInput,
): Promise<Uint8Array> {
  const { implementation, checklist, supplies, progressPercent, readiness, blockers, statusLabel } = input;
  const pdfDoc = await createDoc();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE_SIZE[0] - MARGIN * 2;
  let page = pdfDoc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;
  let pageNumber = 1;

  const drawFooter = () => {
    page.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_SIZE[0] - MARGIN, y: 34 }, thickness: 0.6, color: BORDER });
    page.drawText("STAYO  |  USO INTERNO E OPERACIONAL", { x: MARGIN, y: 20, size: 6.8, font: bold, color: NAVY });
    page.drawText(`Página ${pageNumber}`, { x: PAGE_SIZE[0] - MARGIN - 35, y: 20, size: 6.8, font, color: INK_MUTED });
  };
  const newPage = () => {
    drawFooter();
    page = pdfDoc.addPage(PAGE_SIZE);
    pageNumber += 1;
    y = PAGE_SIZE[1] - MARGIN;
    page.drawRectangle({ x: MARGIN, y: y - 5, width: 26, height: 3, color: CHAMPAGNE });
    page.drawText("RESUMO INTERNO DE IMPLANTAÇÃO", { x: MARGIN + 35, y: y - 8, size: 7.5, font: bold, color: NAVY });
    y -= 30;
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < 52) newPage();
  };
  const paragraph = (value: string, options: { size?: number; color?: ReturnType<typeof rgb>; font?: PDFFont; indent?: number; gap?: number } = {}) => {
    const size = options.size ?? 9;
    const lineHeight = size + 4;
    const indent = options.indent ?? 0;
    const lines = wrapText(value, options.font ?? font, size, contentWidth - indent);
    ensureSpace(lines.length * lineHeight + (options.gap ?? 0));
    for (const line of lines) {
      page.drawText(line, { x: MARGIN + indent, y, size, font: options.font ?? font, color: options.color ?? INK });
      y -= lineHeight;
    }
    y -= options.gap ?? 0;
  };
  const section = (index: number, title: string) => {
    ensureSpace(34);
    page.drawText(String(index).padStart(2, "0"), { x: MARGIN, y, size: 7.5, font: bold, color: CHAMPAGNE });
    page.drawText(safe(title.toUpperCase()), { x: MARGIN + 27, y, size: 10.5, font: bold, color: NAVY });
    page.drawLine({ start: { x: MARGIN + 27, y: y - 7 }, end: { x: PAGE_SIZE[0] - MARGIN, y: y - 7 }, thickness: 0.7, color: BORDER });
    y -= 25;
  };
  const statusTone = readiness.status === "apta" ? SUCCESS : readiness.status === "nao_avaliada" ? WARNING : DANGER;
  const emissionDate = new Date().toLocaleDateString("pt-BR");

  // Cabeçalho institucional navy com a marca oficial em branco.
  page.drawRectangle({ x: 0, y: PAGE_SIZE[1] - 102, width: PAGE_SIZE[0], height: 102, color: NAVY });
  const logoBytes = await rasterUrlAsPng(logoAsset.url);
  if (logoBytes) {
    const logo = await pdfDoc.embedPng(logoBytes);
    const scale = Math.min(88 / logo.width, 55 / logo.height);
    page.drawImage(logo, { x: MARGIN, y: PAGE_SIZE[1] - 80, width: logo.width * scale, height: logo.height * scale });
  } else {
    page.drawText("STAYO", { x: MARGIN, y: PAGE_SIZE[1] - 62, size: 21, font: bold, color: WHITE });
  }
  page.drawText("RESUMO INTERNO", { x: 355, y: PAGE_SIZE[1] - 46, size: 8, font: bold, color: CHAMPAGNE });
  page.drawText("DE IMPLANTAÇÃO", { x: 355, y: PAGE_SIZE[1] - 68, size: 16, font: bold, color: WHITE });
  y = PAGE_SIZE[1] - 126;

  // Capa em enquadramento "cover"; o chamador sempre fornece o placeholder institucional no fallback.
  if (input.coverImageUrl) {
    try {
      const response = await fetch(input.coverImageUrl);
      if (response.ok) {
        const bytes = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") ?? "";
        const image = contentType.includes("png") || input.coverImageUrl.toLowerCase().includes(".png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const imageHeight = 172;
        const scale = Math.min(contentWidth / image.width, imageHeight / image.height);
        const imageWidth = image.width * scale;
        const drawnHeight = image.height * scale;
        page.drawRectangle({ x: MARGIN, y: y - imageHeight, width: contentWidth, height: imageHeight, color: SOFT });
        page.drawImage(image, {
          x: MARGIN + (contentWidth - imageWidth) / 2,
          y: y - imageHeight + (imageHeight - drawnHeight) / 2,
          width: imageWidth,
          height: drawnHeight,
        });
        page.drawRectangle({ x: MARGIN, y: y - imageHeight, width: contentWidth, height: 42, color: NAVY, opacity: 0.86 });
        page.drawText(safe(clamp(propertyLine(implementation), 52)), { x: MARGIN + 16, y: y - imageHeight + 17, size: 15, font: bold, color: WHITE });
        y -= imageHeight + 16;
      }
    } catch {
      // O documento segue sem foto caso o arquivo fique indisponível durante a geração.
    }
  }
  if (y === PAGE_SIZE[1] - 126) {
    page.drawRectangle({ x: MARGIN, y: y - 82, width: contentWidth, height: 82, color: SOFT, borderColor: BORDER, borderWidth: 0.7 });
    page.drawText(safe(clamp(propertyLine(implementation), 52)), { x: MARGIN + 16, y: y - 36, size: 16, font: bold, color: NAVY });
    page.drawText("Imagem institucional indisponível", { x: MARGIN + 16, y: y - 56, size: 8, font, color: INK_MUTED });
    y -= 98;
  }

  page.drawText("CÓDIGO", { x: MARGIN, y, size: 6.8, font: bold, color: INK_MUTED });
  page.drawText("PROPRIETÁRIO", { x: MARGIN + 126, y, size: 6.8, font: bold, color: INK_MUTED });
  page.drawText("RESPONSÁVEL", { x: MARGIN + 302, y, size: 6.8, font: bold, color: INK_MUTED });
  page.drawText("EMISSÃO", { x: MARGIN + 421, y, size: 6.8, font: bold, color: INK_MUTED });
  page.drawText(safe(implementation.code), { x: MARGIN, y: y - 17, size: 9.5, font: bold, color: INK });
  page.drawText(safe(clamp(implementation.ownerName ?? "Não informado", 26)), { x: MARGIN + 126, y: y - 17, size: 9.5, font: bold, color: INK });
  page.drawText(safe(clamp(input.responsibleName ?? "Não definido", 18)), { x: MARGIN + 302, y: y - 17, size: 9.5, font: bold, color: INK });
  page.drawText(emissionDate, { x: MARGIN + 421, y: y - 17, size: 9.5, font: bold, color: INK });
  y -= 47;

  section(1, "Situação atual");
  paragraph(statusLabel, { size: 15, font: bold, color: NAVY });
  paragraph(`Etapa operacional registrada em ${emissionDate}.`, { size: 8.5, color: INK_MUTED, gap: 8 });

  section(2, "Progresso");
  const progress = Math.max(0, Math.min(100, progressPercent));
  page.drawText(`${progress}%`, { x: MARGIN, y, size: 18, font: bold, color: NAVY });
  page.drawText(`${checklist.filter((item) => item.status === "concluido").length} de ${checklist.length} itens concluídos`, { x: MARGIN + 58, y: y + 3, size: 8.5, font, color: INK_MUTED });
  y -= 17;
  page.drawRectangle({ x: MARGIN, y, width: contentWidth, height: 7, color: BORDER });
  if (progress > 0) page.drawRectangle({ x: MARGIN, y, width: contentWidth * (progress / 100), height: 7, color: NAVY_LIGHT });
  y -= 25;

  section(3, "Prontidão");
  paragraph(readiness.label, { size: 15, font: bold, color: statusTone });
  paragraph(
    readiness.status === "nao_avaliada"
      ? "Os requisitos obrigatórios e bloqueadores ainda não foram configurados. Prontidão não é calculada como apta sem avaliação."
      : `${readiness.evaluatedRequirements} requisito(s) avaliado(s), ${readiness.pendingMandatory} obrigatório(s) pendente(s) e ${readiness.pendingBlockers} bloqueador(es) aberto(s).`,
    { size: 8.5, color: INK_MUTED, gap: 10 },
  );

  section(4, "Pendências críticas");
  if (blockers.length === 0) paragraph("Nenhuma pendência crítica registrada.", { color: INK_MUTED, gap: 10 });
  else for (const blocker of blockers) paragraph(`• ${blocker}`, { size: 9, color: DANGER, indent: 4, gap: 2 });
  y -= 8;

  section(5, "Checklist por fase");
  if (checklist.length === 0) paragraph("Checklist ainda não configurado.", { color: INK_MUTED, gap: 8 });
  else {
    const byPhase = new Map<string, ImplementationItem[]>();
    for (const item of checklist) byPhase.set(item.phase, [...(byPhase.get(item.phase) ?? []), item]);
    for (const [phase, phaseItems] of byPhase) {
      ensureSpace(38);
      const done = phaseItems.filter((item) => item.status === "concluido").length;
      paragraph(`${phase}  |  ${done}/${phaseItems.length} concluídos`, { size: 9.5, font: bold, color: NAVY, gap: 1 });
      for (const item of phaseItems) {
        const tags = [itemStatusLabels[item.status], item.mandatory ? "obrigatório" : null, item.blocker ? "bloqueador" : null].filter(Boolean).join(" · ");
        paragraph(`• ${item.title}  —  ${tags}`, { size: 8.4, color: item.blocker && item.status !== "concluido" ? DANGER : INK_MUTED, indent: 5, gap: 1 });
      }
      y -= 5;
    }
  }
  y -= 8;

  section(6, "Enxoval e itens faltantes");
  const missingTotal = supplies.reduce((sum, item) => sum + missingQty(item), 0);
  const blockingSupplies = supplies.filter((item) => item.blocksReadiness && missingQty(item) > 0).length;
  paragraph(`${supplies.length} itens cadastrados  |  ${missingTotal} peças faltando  |  ${blockingSupplies} bloqueiam prontidão`, { size: 9, font: bold, color: NAVY, gap: 3 });
  const openSupplies = supplies.filter((item) => missingQty(item) > 0 && item.status !== "nao_aplicavel");
  if (openSupplies.length === 0) paragraph("Nenhum item faltante registrado.", { color: INK_MUTED, gap: 8 });
  else for (const item of openSupplies) {
    const details = [item.module === "enxoval" ? "Enxoval" : "Item faltante", item.room, `falta ${missingQty(item)}`, supplyStatusLabels[item.status], item.blocksReadiness ? "bloqueia prontidão" : null].filter(Boolean).join(" · ");
    paragraph(`• ${item.name}  —  ${details}`, { size: 8.4, color: item.blocksReadiness ? DANGER : INK_MUTED, indent: 5, gap: 1 });
  }
  y -= 8;

  section(7, "Observações operacionais relevantes");
  const notes = safeOperationalNotes(implementation.notes);
  paragraph(notes ?? "Nenhuma observação operacional registrada.", { size: 9, color: notes ? INK : INK_MUTED, gap: 10 });
  paragraph("Por segurança, este documento omite senhas, Wi-Fi, fechaduras, chaves, tokens, credenciais e documentos pessoais.", { size: 7.5, color: INK_MUTED });

  drawFooter();
  return pdfDoc.save();
}
