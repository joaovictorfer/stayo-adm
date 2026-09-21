/**
 * Gerador de PDF da proposta (Fase 7 do plano de evolução).
 *
 * Roda no navegador (client-side). Usa o StayoPdfBuilder subjacente
 * para formatação uniforme (cabeçalho, paginação, margens e tipografia).
 */

import type { CommercialTerm } from "../../types/admin";
import type { ImplementationProject, Proposal } from "../../types/core";
import { PDF_STYLES, StayoPdfBuilder } from "./base-document";

export interface ProposalPdfInput {
  implementation: ImplementationProject;
  proposal: Proposal;
  recurringTerms: CommercialTerm[];
  portalUrl: string | null;
  validityDays?: number;
  coverImageBytes?: Uint8Array;
}

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
  const { implementation, proposal, recurringTerms, portalUrl, validityDays = 15, coverImageBytes } = input;

  const builder = await StayoPdfBuilder.create("Proposta Comercial", new Date(proposal.createdAt));

  const subtitle = [implementation.nickname, implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ");
  
  await builder.drawCover(
    "Proposta comercial de implantação",
    subtitle || `Código: ${implementation.code}`,
    coverImageBytes
  );

  builder.text(`Proprietário: ${implementation.ownerName ?? "—"}`, { size: 10, color: PDF_STYLES.colors.inkMuted });
  builder.text(`Versão: ${proposal.version}`, { size: 10, color: PDF_STYLES.colors.inkMuted });
  builder.text(`Válida por ${validityDays} dias a partir da data de geração`, { size: 10, color: PDF_STYLES.colors.inkMuted });

  // Força que a primeira página de conteúdo efetivamente tenha aderência ao layout de texto padrão
  builder.addPage(true);

  builder.text("Condições comerciais", { size: 13, font: "bold", color: PDF_STYLES.colors.forest });
  builder.spacer(4);
  for (const item of proposal.items) {
    builder.ensureSpace(14);
    builder.text(`${item.description}  ·  ${item.quantity}x  ·  ${currency.format(item.total)}`, { size: 10 });
  }
  builder.spacer(4);
  builder.text(`Total: ${currency.format(proposal.total)}`, { size: 12, font: "bold", color: PDF_STYLES.colors.ink });
  builder.spacer(12);

  if (recurringTerms.length > 0) {
    builder.rule();
    builder.text("Condições recorrentes (aplicadas durante a operação)", {
      size: 12,
      font: "bold",
      color: PDF_STYLES.colors.forest,
    });
    builder.spacer(4);
    for (const term of recurringTerms) {
      const value = term.chargeType === "percentage" ? `${term.value}%` : currency.format(term.value);
      builder.text(`${term.label} — ${value} (${chargeTypeLabels[term.chargeType]})`, { size: 10 });
    }
    builder.spacer(12);
  }

  builder.rule();
  builder.text("Escopo Stayo", { size: 13, font: "bold", color: PDF_STYLES.colors.forest });
  builder.spacer(4);
  builder.text("Gestão completa da hospedagem: divulgação em canais, precificação, atendimento ao", {
    size: 10,
    color: PDF_STYLES.colors.inkMuted,
  });
  builder.text("hóspede, limpeza e vistoria entre estadias, e repasse financeiro ao proprietário.", {
    size: 10,
    color: PDF_STYLES.colors.inkMuted,
  });
  builder.spacer(12);

  builder.rule();
  builder.text("Próximos passos", { size: 13, font: "bold", color: PDF_STYLES.colors.forest });
  builder.spacer(4);
  if (portalUrl) {
    builder.text("Acompanhe a implantação e aceite esta proposta em:", { size: 10, color: PDF_STYLES.colors.inkMuted });
    builder.text(portalUrl, { size: 10, font: "bold", color: PDF_STYLES.colors.forest });
  } else {
    builder.text("Fale com a equipe Stayo para gerar o link de acompanhamento.", {
      size: 10,
      color: PDF_STYLES.colors.inkMuted,
    });
  }

  return builder.save();
}
