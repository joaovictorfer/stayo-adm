/**
 * Tipo de valor de cada serviço da proposta. Só "fixed" entra no total definido.
 * Versões antigas (sem o campo) são lidas de forma conservadora:
 * opcional marcado → optional; valor zero → tbd ("Valor a definir"); resto → fixed.
 */
export type ItemPricing = "fixed" | "optional" | "conditional" | "tbd";

export const PRICING_LABELS: Record<ItemPricing, string> = {
  fixed: "Preço fixo",
  optional: "Opcional",
  conditional: "Depende de avaliação",
  tbd: "Valor a definir",
};

type PricedItem = {
  total?: number;
  unitValue?: number;
  quantity?: number;
  discount?: number;
  optional?: boolean;
  pricing?: ItemPricing | null;
  details?: string | null;
  scope?: string[];
};

export function resolvePricing(item: PricedItem): ItemPricing {
  if (item.pricing) return item.pricing;
  if (item.optional) return "optional";
  const total =
    item.total ??
    Math.max(0, (item.quantity ?? 1) * (item.unitValue ?? 0) - (item.discount ?? 0));
  return total > 0 ? "fixed" : "tbd";
}

/** Valor que entra no "Valor definido nesta proposta". */
export function countsInDefinedTotal(item: PricedItem): boolean {
  return resolvePricing(item) === "fixed";
}

const CONDITIONAL_HINT = /(depend|conforme|a definir|avalia|or[cç]amento|fornecedor|sob consulta)/i;

/** Divergências entre descrição, preço e tipo — mostradas só na administração. */
export function pricingIssues(item: PricedItem & { description?: string }): string[] {
  const p = resolvePricing(item);
  const total =
    item.total ??
    Math.max(0, (item.quantity ?? 1) * (item.unitValue ?? 0) - (item.discount ?? 0));
  const text = [item.details ?? "", ...(item.scope ?? [])].join(" ");
  const issues: string[] = [];
  if (p === "fixed" && total <= 0)
    issues.push("Marcado como preço fixo, mas o valor é R$ 0,00. Use “Valor a definir”.");
  if (p === "fixed" && CONDITIONAL_HINT.test(text))
    issues.push(
      "A descrição indica cobrança condicional, mas o tipo é preço fixo. Ajuste o tipo ou a descrição.",
    );
  if (p === "tbd" && total > 0)
    issues.push("Marcado como “Valor a definir”, mas tem valor preenchido. O valor não será exibido.");
  return issues;
}
