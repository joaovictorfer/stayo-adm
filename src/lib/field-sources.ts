/** Origem e divergência de dados da ficha. Nunca altera nada sozinho: só descreve. */
export type SourceBadge = "oficial" | "enviado" | "nota";
export type Decision = "usar_oficial" | "conferir_local";
export interface StoredDecision { decision: Decision; snapshot: string }

export interface ResolvedField {
  value: string | null;
  badge: SourceBadge | null;
  missing: boolean;
  divergence: { official: string; submitted: string; checking: boolean } | null;
}

export type NormalizeKind = "text" | "digits" | "email";
export function normalize(v: string | null | undefined, kind: NormalizeKind = "text"): string {
  const s = (v ?? "").trim();
  if (kind === "digits") return s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (kind === "email") return s.toLowerCase();
  return s.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

/** Chave estável da divergência: decisão só vale enquanto os dois valores forem os mesmos. */
export const divergenceSnapshot = (official: string, submitted: string) => `${official}|${submitted}`;

export function resolveField(
  official: string | null | undefined,
  submitted: string | null | undefined,
  kind: NormalizeKind = "text",
  stored?: StoredDecision | null,
): ResolvedField {
  const o = (official ?? "").trim();
  const s = (submitted ?? "").trim();
  if (!o && !s) return { value: null, badge: null, missing: true, divergence: null };
  if (o && (!s || normalize(o, kind) === normalize(s, kind))) return { value: o, badge: "oficial", missing: false, divergence: null };
  if (!o) return { value: s, badge: "enviado", missing: false, divergence: null };
  const valid = stored && stored.snapshot === divergenceSnapshot(o, s) ? stored.decision : null;
  if (valid === "usar_oficial") return { value: o, badge: "oficial", missing: false, divergence: null };
  return { value: o, badge: "oficial", missing: false, divergence: { official: o, submitted: s, checking: valid === "conferir_local" } };
}

export interface CompositionCounts { bedrooms: number | null; bathrooms: number | null; lavatories: number | null }
export interface CompositionRoom { kind: string; suite?: boolean | undefined; bath?: unknown }

/** Contagem pela coleta (ambientes da vistoria): banheiro de suíte entra no total de banheiros. */
export function countsFromRooms(rooms: CompositionRoom[] | null | undefined): CompositionCounts | null {
  if (!rooms?.length) return null;
  const quartos = rooms.filter((r) => r.kind === "quarto");
  return {
    bedrooms: quartos.length,
    bathrooms: rooms.filter((r) => r.kind === "banheiro").length + quartos.filter((r) => r.suite).length,
    lavatories: rooms.filter((r) => r.kind === "lavabo").length,
  };
}

export const COMPOSITION_LABELS: Record<keyof CompositionCounts, string> = { bedrooms: "Quartos", bathrooms: "Banheiros", lavatories: "Lavabos" };

/** Cadastro x coleta: só aponta, quem decide é a equipe ("Conferir na vistoria"). */
export function compositionDivergences(registered: CompositionCounts, collected: CompositionCounts | null) {
  if (!collected) return [];
  return (Object.keys(COMPOSITION_LABELS) as Array<keyof CompositionCounts>)
    .filter((k) => registered[k] != null && collected[k] != null && registered[k] !== collected[k])
    .map((k) => ({ key: k, label: COMPOSITION_LABELS[k], registered: registered[k] as number, collected: collected[k] as number }));
}
