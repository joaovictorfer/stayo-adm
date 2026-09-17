/**
 * Gerador de PDF da proposta (Fase 7 do plano de evolução).
 *
 * Roda no navegador (client-side) — não existe backend real ainda; os
 * dados vivem em localStorage, então o PDF só pode nascer de onde os dados
 * já estão. O PDF é sempre gerado a partir do MESMO snapshot imutável de
 * uma `Proposal` (uma versão específica) — nunca de "a versão mais
 * recente". Regenerar o PDF da mesma versão sempre produz o mesmo
 * documento; não há necessidade de armazená-lo à parte enquanto isso for
 * verdade (ver docs/OWNER_IMPLEMENTATION_ARCHITECTURE.md).
 *
 * Nunca inclui dados bancários ou documento completo (nada disso existe
 * neste tipo de proposta comercial de qualquer forma).
 */

import { PDFDocument, type PDFFont, StandardFonts, rgb } from "pdf-lib";

import type { CommercialTerm } from "../../types/admin";
import type { ImplementationProject, Proposal } from "../../types/core";

export interface ProposalPdfInput {
  implementation: ImplementationProject;
  proposal: Proposal;
  recurringTerms: CommercialTerm[];
  portalUrl: string | null;
  /** Dias de validade a partir da geração — default do plano, ainda sem tela de configuração própria. */
  validityDays?: number;
}

const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4 em pontos
const MARGIN = 56;
const FOREST = rgb(0.13, 0.25, 0.18);
const INK = rgb(0.11, 0.14, 0.11);
const INK_MUTED = rgb(0.36, 0.4, 0.37);
const BORDER = rgb(0.88, 0.87, 0.82);

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const chargeTypeLabels: Record<CommercialTerm["chargeType"], string> = {
  percentage: "percentual",
  fixed_once: "valor fixo",
  per_reservation: "por reserva",
  monthly: "mensal",
  optional: "opcional",
  informational: "informativo",
};

export async function generateProposalPdf(input: ProposalPdfInput): Promise<Uint8Array> {
  const { implementation, proposal, recurringTerms, portalUrl, validityDays = 15 } = input;

  const pdfDoc = await PDFDocument.create();
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

  const text = (
    value: string,
    opts: { size?: number; color?: ReturnType<typeof rgb>; font?: PDFFont; x?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    ensureSpace(size + 6);
    page.drawText(value, {
      x: opts.x ?? MARGIN,
      y,
      size,
      font: opts.font ?? font,
      color: opts.color ?? INK,
    });
    y -= size + 6;
  };

  const spacer = (h = 10) => {
    y -= h;
  };

  const rule = () => {
    ensureSpace(12);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_SIZE[0] - MARGIN, y },
      thickness: 0.75,
      color: BORDER,
    });
    y -= 14;
  };

  // Capa
  text("STAYO", { size: 20, font: bold, color: FOREST });
  spacer(4);
  text("Proposta comercial de implantação", { size: 14, font: bold, color: INK });
  spacer(8);
  text(`Código: ${implementation.code}`, { size: 10, color: INK_MUTED });
  text(`Proprietário: ${implementation.ownerName ?? "—"}`, { size: 10, color: INK_MUTED });
  text(
    `Imóvel: ${[implementation.nickname, implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ") || "—"}`,
    { size: 10, color: INK_MUTED },
  );
  text(`Data: ${new Date(proposal.createdAt).toLocaleDateString("pt-BR")}`, {
    size: 10,
    color: INK_MUTED,
  });
  text(`Versão: ${proposal.version}`, { size: 10, color: INK_MUTED });
  text(`Válida por ${validityDays} dias a partir da data acima`, { size: 10, color: INK_MUTED });
  spacer(12);
  rule();

  // Condições comerciais — itens da proposta
  text("Condições comerciais", { size: 13, font: bold, color: FOREST });
  spacer(4);
  for (const item of proposal.items) {
    ensureSpace(14);
    text(`${item.description}  ·  ${item.quantity}x  ·  ${currency.format(item.total)}`, {
      size: 10,
    });
  }
  spacer(4);
  text(`Total: ${currency.format(proposal.total)}`, { size: 12, font: bold, color: INK });
  spacer(12);

  if (recurringTerms.length > 0) {
    rule();
    text("Condições recorrentes (aplicadas durante a operação)", {
      size: 12,
      font: bold,
      color: FOREST,
    });
    spacer(4);
    for (const term of recurringTerms) {
      const value =
        term.chargeType === "percentage" ? `${term.value}%` : currency.format(term.value);
      text(`${term.label} — ${value} (${chargeTypeLabels[term.chargeType]})`, { size: 10 });
    }
    spacer(12);
  }

  rule();
  text("Escopo Stayo", { size: 13, font: bold, color: FOREST });
  spacer(4);
  text("Gestão completa da hospedagem: divulgação em canais, precificação, atendimento ao", {
    size: 10,
    color: INK_MUTED,
  });
  text("hóspede, limpeza e vistoria entre estadias, e repasse financeiro ao proprietário.", {
    size: 10,
    color: INK_MUTED,
  });
  spacer(12);

  rule();
  text("Próximos passos", { size: 13, font: bold, color: FOREST });
  spacer(4);
  if (portalUrl) {
    text("Acompanhe a implantação e aceite esta proposta em:", { size: 10, color: INK_MUTED });
    text(portalUrl, { size: 10, font: bold, color: FOREST });
  } else {
    text("Fale com a equipe Stayo para gerar o link de acompanhamento.", {
      size: 10,
      color: INK_MUTED,
    });
  }

  return pdfDoc.save();
}
