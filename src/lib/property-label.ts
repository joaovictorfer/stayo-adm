/** Nome único do imóvel para telas e relatórios: apelido da ficha (ex.: "Vêneto H403") antes de condomínio + unidade, que perde a torre. */
export function propertyLabel(p: { nickname?: string | null; condominium_name?: string | null; unit?: string | null; code?: string | null }): string {
  return p.nickname?.trim() || [p.condominium_name, p.unit].filter(Boolean).join(" ") || p.code || "Imóvel";
}
