export type PayoutPropertyEligibility = { status: string; core_property_id: string | null };

/** Only operational, linked properties belong in the payout workspace. */
export function isPayoutPropertyEligible(property: PayoutPropertyEligibility): boolean {
  return property.status === "ativo" && Boolean(property.core_property_id?.trim());
}

export function matchesPayoutPropertySearch(property: { code: string; nickname: string | null; condominium_name: string | null; unit: string | null }, search: string): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const text = normalize([property.code, property.nickname, property.condominium_name, property.unit].filter(Boolean).join(" "));
  return search.trim().split(/\s+/).every(part => text.includes(normalize(part)));
}