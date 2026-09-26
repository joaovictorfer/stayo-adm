import type { CommercialProposalSnapshot } from "../types/commercial-proposal";
import type { ProposalItem } from "../types/core";
import { formatBRL } from "./money";
import { resolvePricing, type ItemPricing } from "./proposal-pricing";

const POST_CONSTRUCTION_CLEANING = /limpeza\s+p[oó]s[- ]obra/i;

type ContractConditions = CommercialProposalSnapshot["contractConditions"];

export interface PublishedItemGroups {
  fixed: ProposalItem[];
  optional: ProposalItem[];
  pending: ProposalItem[];
  fixedTotal: number;
}

export interface PublishedCleaningDecision {
  value: string;
  price: string | null;
  help: string;
  state: "defined" | "quote";
}

function cleaningPayer(c: ContractConditions): string | null {
  if (c.initialCleaningCostBearer === "owner") return "paga pelo proprietário";
  if (c.initialCleaningCostBearer === "stayo") return "paga pela STAYO";
  return null;
}

/** Resolve preço, responsável e total da limpeza pós-obra apenas com o snapshot publicado. */
export function publishedProposalPresentation(snapshot: CommercialProposalSnapshot): {
  groups: PublishedItemGroups;
  cleaningDecision: PublishedCleaningDecision | null;
} {
  const c = snapshot.contractConditions ?? {};
  const items = snapshot.items ?? [];
  const cleaningItems = items.filter((item) => POST_CONSTRUCTION_CLEANING.test(item.description));
  const otherItems = items.filter((item) => !POST_CONSTRUCTION_CLEANING.test(item.description));
  const explicitlyPending = cleaningItems.some((item) => {
    const pricing = resolvePricing(item);
    return pricing === "conditional" || pricing === "tbd";
  });
  const fixedCleaning = cleaningItems.find(
    (item) => resolvePricing(item) === "fixed" && Number(item.total) > 0,
  );
  const approvedValue = explicitlyPending
    ? null
    : fixedCleaning
      ? Number(fixedCleaning.total)
      : c.initialCleaningFee != null && c.initialCleaningFee > 0
        ? Number(c.initialCleaningFee)
        : null;
  const payer = cleaningPayer(c);
  const cleaningSelected = c.initialCleaningOption === "stayo_post_construction";
  const normalizedCleaning: ProposalItem | null = cleaningSelected
    ? {
        description: "Limpeza pós-obra",
        quantity: 1,
        unitValue: approvedValue ?? 0,
        discount: 0,
        total: approvedValue ?? 0,
        details:
          approvedValue != null
            ? ["Valor aprovado para esta proposta", payer].filter(Boolean).join(" · ")
            : "Valor a definir após avaliação",
        scope: fixedCleaning?.scope ?? [],
        pricing: approvedValue != null ? "fixed" : "conditional",
      }
    : null;
  const normalizedItems = normalizedCleaning ? [...otherItems, normalizedCleaning] : items;
  const byPricing = (pricing: ItemPricing) =>
    normalizedItems.filter((item) => resolvePricing(item) === pricing);
  const fixed = byPricing("fixed");
  const optional = byPricing("optional");
  const pending = normalizedItems.filter((item) => {
    const pricing = resolvePricing(item);
    return pricing === "conditional" || pricing === "tbd";
  });

  return {
    groups: {
      fixed,
      optional,
      pending,
      fixedTotal: fixed.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    },
    cleaningDecision: cleaningSelected
      ? {
          value: "Limpeza pós-obra",
          price: approvedValue != null ? formatBRL(approvedValue) : null,
          help:
            approvedValue != null
              ? [formatBRL(approvedValue), payer, "Preparação inicial; diferente da limpeza entre hospedagens."]
                  .filter(Boolean)
                  .join(" · ")
              : "Valor a definir após avaliação. O serviço e a cobrança ainda não estão acordados.",
          state: approvedValue != null ? "defined" : "quote",
        }
      : null,
  };
}