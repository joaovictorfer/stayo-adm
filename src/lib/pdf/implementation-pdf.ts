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
import {
  supplyPriorityLabels,
  supplyStatusLabels,
  type SupplyItem,
  type SupplyModule,
} from "../../types/implementation-supply";

const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 56;
const FOREST = rgb(0.13, 0.25, 0.18);
const INK = rgb(0.11, 0.14, 0.11);
const INK_MUTED = rgb(0.36, 0.4, 0.37);
const BORDER = rgb(0.88, 0.87, 0.82);

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
  ready: boolean;
  blockers: string[];
  statusLabel: string;
}

export async function generateImplementationSummaryPdf(
  input: ImplementationSummaryPdfInput,
): Promise<Uint8Array> {
  const { implementation, checklist, supplies, progressPercent, ready, blockers, statusLabel } =
    input;
  const { writer, bold } = await makeWriter();

  header(writer, bold, implementation, "Resumo da implantação");

  writer.text("Situação", { size: 13, font: bold, color: FOREST });
  writer.spacer(2);
  writer.text(`Status: ${statusLabel}`, { size: 10 });
  writer.text(`Progresso do checklist: ${progressPercent}%`, { size: 10 });
  writer.text(`Prontidão operacional: ${ready ? "Apta" : "Não apta"}`, {
    size: 10,
    font: bold,
  });
  writer.text(
    "Progresso e prontidão são números separados: uma implantação pode estar quase concluída e continuar não apta por um único item bloqueador.",
    { size: 9, color: INK_MUTED },
  );
  writer.spacer(10);

  writer.rule();
  writer.text("Precisa de atenção", { size: 13, font: bold, color: FOREST });
  writer.spacer(2);
  if (blockers.length === 0) {
    writer.text("Nenhuma pendência bloqueadora.", { size: 10, color: INK_MUTED });
  } else {
    for (const blocker of blockers) {
      writer.text(`- ${clamp(blocker, 90)}`, { size: 10 });
    }
  }
  writer.spacer(10);

  writer.rule();
  writer.text("Checklist por fase", { size: 13, font: bold, color: FOREST });
  writer.spacer(2);
  if (checklist.length === 0) {
    writer.text("Checklist ainda não montado.", { size: 10, color: INK_MUTED });
  } else {
    const byPhase = new Map<string, ImplementationItem[]>();
    for (const item of checklist) {
      byPhase.set(item.phase, [...(byPhase.get(item.phase) ?? []), item]);
    }
    for (const [phase, phaseItems] of byPhase) {
      writer.text(phase, { size: 11, font: bold });
      for (const item of phaseItems) {
        const tags = [
          item.status,
          item.mandatory ? "obrigatório" : null,
          item.blocker ? "bloqueador" : null,
        ]
          .filter(Boolean)
          .join(", ");
        writer.text(`   ${clamp(item.title, 60)}  ·  ${tags}`, { size: 9.5, color: INK_MUTED });
      }
      writer.spacer(4);
    }
  }

  writer.rule();
  writer.text("Enxoval e itens faltantes", { size: 13, font: bold, color: FOREST });
  writer.spacer(2);
  const missingTotal = supplies.reduce((sum, item) => sum + missingQty(item), 0);
  const blockingSupplies = supplies.filter((i) => i.blocksReadiness && missingQty(i) > 0).length;
  writer.text(
    `Itens cadastrados: ${supplies.length}  ·  Peças faltando: ${missingTotal}  ·  Itens que bloqueiam a prontidão: ${blockingSupplies}`,
    { size: 10 },
  );
  writer.spacer(10);

  writer.rule();
  writer.text(
    "Documento interno Stayo. Não contém dados de acesso do imóvel (Wi-Fi, fechadura, chaves) nem documentos pessoais.",
    { size: 9, color: INK_MUTED },
  );

  return writer.finish();
}
