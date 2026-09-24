/**
 * PDF da proposta publicada.
 *
 * Regra da Fase 2C: o documento é derivado exclusivamente do snapshot
 * imutável da versão publicada. Nenhuma condição viva é consultada aqui.
 */

import type { CommercialProposalSnapshot } from "../../types/commercial-proposal";
import { PDF_STYLES, StayoPdfBuilder } from "./base-document";

export interface ProposalPdfInput {
  snapshot: CommercialProposalSnapshot;
  coverImageBytes?: Uint8Array;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function valueLabel(term: CommercialProposalSnapshot["commercialTerms"][number]): string {
  return term.chargeType === "percentage" ? `${term.value}%` : currency.format(term.value);
}

export async function generateProposalPdf(input: ProposalPdfInput): Promise<Uint8Array> {
  const { snapshot, coverImageBytes } = input;
  const builder = await StayoPdfBuilder.create(
    "Proposta Comercial",
    new Date(snapshot.publishedAt),
  );

  await builder.drawCover(
    "Proposta comercial de implantação",
    snapshot.opportunity.title || `Código: ${snapshot.opportunity.code}`,
    coverImageBytes,
  );

  builder.text(`Versão: ${snapshot.version}`, {
    size: 10,
    color: PDF_STYLES.colors.inkMuted,
  });
  builder.text(`Publicada em ${new Date(snapshot.publishedAt).toLocaleString("pt-BR")}`, {
    size: 10,
    color: PDF_STYLES.colors.inkMuted,
  });

  builder.addPage(true);
  builder.text("Serviços e valores", {
    size: 13,
    font: "bold",
    color: PDF_STYLES.colors.forest,
  });
  builder.spacer(4);

  for (const item of snapshot.items) {
    builder.ensureSpace(14);
    builder.text(
      `${item.description} · ${item.quantity}x · ${currency.format(item.total)}`,
      { size: 10 },
    );
  }

  builder.spacer(4);
  builder.text(`Total: ${currency.format(snapshot.total)}`, {
    size: 12,
    font: "bold",
    color: PDF_STYLES.colors.ink,
  });

  if (snapshot.commercialTerms.length > 0) {
    builder.spacer(12);
    builder.rule();
    builder.text("Condições comerciais", {
      size: 12,
      font: "bold",
      color: PDF_STYLES.colors.forest,
    });
    builder.spacer(4);
    for (const term of snapshot.commercialTerms) {
      builder.text(`${term.label} — ${valueLabel(term)}`, { size: 10 });
      if (term.notes) {
        builder.text(term.notes, { size: 9, color: PDF_STYLES.colors.inkMuted });
      }
    }
  }

  const conditions = snapshot.contractConditions;
  if (Object.keys(conditions).length > 0) {
    builder.spacer(12);
    builder.rule();
    builder.text("Condições contratuais apresentadas", {
      size: 12,
      font: "bold",
      color: PDF_STYLES.colors.forest,
    });
    builder.spacer(4);
    if (conditions.administrationFee != null) {
      builder.text(`Administração: ${conditions.administrationFee}%`, { size: 10 });
    }
    if (conditions.cleaningResponsibility) {
      builder.text(`Limpeza: ${conditions.cleaningResponsibility}`, { size: 10 });
    }
    if (conditions.payoutRule) {
      builder.text(`Repasse: ${conditions.payoutRule}`, { size: 10 });
    }
    if (conditions.maintenanceLimit != null) {
      builder.text(`Limite de manutenção: ${currency.format(conditions.maintenanceLimit)}`, {
        size: 10,
      });
    }
    if (conditions.durationMonths != null) {
      builder.text(`Vigência: ${conditions.durationMonths} meses`, { size: 10 });
    }
    if (conditions.noticePeriodDays != null) {
      builder.text(`Aviso prévio: ${conditions.noticePeriodDays} dias`, { size: 10 });
    }
  }

  if (snapshot.responsibilities.length > 0) {
    builder.spacer(12);
    builder.rule();
    builder.text("Responsabilidades", {
      size: 12,
      font: "bold",
      color: PDF_STYLES.colors.forest,
    });
    builder.spacer(4);
    for (const responsibility of snapshot.responsibilities) {
      builder.text(`• ${responsibility}`, { size: 10 });
    }
  }

  if (snapshot.content.length > 0) {
    builder.spacer(12);
    builder.rule();
    for (const block of snapshot.content) {
      builder.text(block.title, {
        size: 12,
        font: "bold",
        color: PDF_STYLES.colors.forest,
      });
      builder.spacer(2);
      builder.text(block.body, { size: 10, color: PDF_STYLES.colors.inkMuted });
      builder.spacer(6);
    }
  }

  if (snapshot.requiredSignatories.length > 0) {
    builder.spacer(12);
    builder.rule();
    builder.text("Signatários comerciais exigidos", {
      size: 12,
      font: "bold",
      color: PDF_STYLES.colors.forest,
    });
    builder.spacer(4);
    for (const signatory of snapshot.requiredSignatories) {
      builder.text(
        `${signatory.label}${signatory.role ? ` — ${signatory.role}` : ""}`,
        { size: 10 },
      );
    }
  }

  return builder.save();
}
