import type { Contract } from "../types/core";

/** Contratos com `endDate` dentro dos próximos `days` dias, a partir de `now`. Ignora contratos sem prazo definido. */
export function contractsExpiringWithin(
  contracts: Contract[],
  days: number,
  now: Date = new Date(),
): Contract[] {
  const horizon = now.getTime() + days * 24 * 60 * 60 * 1000;
  return contracts.filter((c) => {
    if (!c.endDate) return false;
    const end = Date.parse(c.endDate);
    return !Number.isNaN(end) && end >= now.getTime() && end <= horizon;
  });
}
