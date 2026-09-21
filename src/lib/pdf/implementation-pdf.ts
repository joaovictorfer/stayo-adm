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
        const scale = Math.max(width / image.width, height / image.height);
        const drawnWidth = image.width * scale;
        const drawnHeight = image.height * scale;
        ensureSpace(height + 12);
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
  const { writer, bold } = await makeWriter();

  writer.text("STAYO", { size: 22, font: bold, color: NAVY });
  writer.text("RESUMO INTERNO DE IMPLANTAÇÃO", { size: 8, font: bold, color: NAVY_LIGHT });
  writer.spacer(8);
  writer.rule();
  if (input.coverImageUrl) await writer.coverImage(input.coverImageUrl);
  writer.text(propertyLine(implementation), { size: 17, font: bold, color: INK });
  writer.spacer(3);
  writer.text(`Código ${implementation.code}  ·  Proprietário ${implementation.ownerName ?? "Não informado"}`, { size: 9.5, color: INK_MUTED });
  writer.text(`Responsável ${input.responsibleName ?? "Não definido"}  ·  Atualizado em ${new Date().toLocaleDateString("pt-BR")}`, { size: 9.5, color: INK_MUTED });
  writer.spacer(16);

  const metricWidth = (PAGE_SIZE[0] - MARGIN * 2 - 20) / 3;
  writer.metric("Situação atual", statusLabel, MARGIN, metricWidth);
  writer.metric("Progresso", `${progressPercent}%`, MARGIN + metricWidth + 10, metricWidth);
  writer.metric(
    "Prontidão",
    readiness.label,
    MARGIN + (metricWidth + 10) * 2,
    metricWidth,
    readiness.status === "apta" ? SUCCESS : readiness.status === "nao_avaliada" ? INK_MUTED : DANGER,
  );
  writer.spacer(66);
  writer.text("Progresso do checklist", { size: 8.5, font: bold, color: INK_MUTED });
  writer.progress(progressPercent);
  writer.text(
    `Prontidão avalia requisitos críticos separadamente: ${readiness.evaluatedRequirements} requisito(s), ${readiness.pendingMandatory} obrigatório(s) e ${readiness.pendingBlockers} bloqueador(es) pendente(s).`,
    { size: 8.5, color: INK_MUTED },
  );
  writer.spacer(12);

  writer.section("Pendências críticas");
  if (blockers.length === 0) {
    writer.text("Nenhuma pendência crítica registrada.", { size: 10, color: INK_MUTED });
  } else {
    for (const blocker of blockers) {
      writer.text(`- ${clamp(blocker, 82)}`, { size: 9.5, color: DANGER });
    }
  }
  writer.spacer(12);

  writer.section("Checklist por fase");
  if (checklist.length === 0) {
    writer.text("Checklist ainda não montado.", { size: 10, color: INK_MUTED });
  } else {
    const byPhase = new Map<string, ImplementationItem[]>();
    for (const item of checklist) {
      byPhase.set(item.phase, [...(byPhase.get(item.phase) ?? []), item]);
    }
    for (const [phase, phaseItems] of byPhase) {
      writer.text(`${phase}  ·  ${phaseItems.filter((item) => item.status === "concluido").length}/${phaseItems.length} concluídos`, { size: 10.5, font: bold, color: NAVY });
      for (const item of phaseItems) {
        const tags = [
          itemStatusLabels[item.status],
          item.mandatory ? "obrigatório" : null,
          item.blocker ? "bloqueador" : null,
        ]
          .filter(Boolean)
          .join(", ");
        writer.text(`   ${clamp(item.title, 58)}  ·  ${tags}`, { size: 9, color: INK_MUTED });
      }
      writer.spacer(7);
    }
  }

  writer.spacer(6);
  writer.section("Enxoval e itens faltantes");
  const missingTotal = supplies.reduce((sum, item) => sum + missingQty(item), 0);
  const blockingSupplies = supplies.filter((i) => i.blocksReadiness && missingQty(i) > 0).length;
  writer.text(
    `Itens cadastrados: ${supplies.length}  ·  Peças faltando: ${missingTotal}  ·  Itens que bloqueiam a prontidão: ${blockingSupplies}`,
    { size: 9.5, font: bold },
  );
  const openSupplies = supplies.filter((item) => missingQty(item) > 0 && item.status !== "nao_aplicavel");
  if (openSupplies.length === 0) {
    writer.text("Nenhum item faltante registrado.", { size: 9.5, color: INK_MUTED });
  } else {
    for (const item of openSupplies) {
      const details = [
        item.module === "enxoval" ? "Enxoval" : "Item faltante",
        item.room,
        `falta ${missingQty(item)}`,
        supplyStatusLabels[item.status],
        item.blocksReadiness ? "bloqueia prontidão" : null,
      ].filter(Boolean);
      writer.text(`- ${clamp(item.name, 48)}  ·  ${details.join(" · ")}`, {
        size: 9,
        color: item.blocksReadiness ? DANGER : INK_MUTED,
      });
    }
  }
  writer.spacer(14);

  writer.rule();
  writer.text("Documento interno STAYO · Uso operacional", { size: 8, font: bold, color: NAVY });
  writer.text("Este resumo não contém senhas, Wi-Fi, fechaduras, chaves, tokens ou documentos pessoais.", { size: 8, color: INK_MUTED });

  return writer.finish();
}
