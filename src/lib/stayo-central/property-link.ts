/** Regras puras do vínculo ficha ↔ imóvel do STAYO APP (sem rede). */
export interface AppPropertyCandidate { id: string; name: string | null; code: string | null; address: string | null; city: string | null; linkedToCode: string | null }
export interface LocalPropertyView { condominium: string | null; unit: string | null; address: string | null }
export interface LinkComparisonRow { key: "condominium" | "unit" | "address"; label: string; local: string | null; app: string | null; differs: boolean }

const norm = (v: string | null | undefined) => (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Busca local nas páginas lidas da API: nome, código ou endereço contém todos os termos. */
export function matchesQuery(c: Pick<AppPropertyCandidate, "name" | "code" | "address">, query: string) {
  const terms = norm(query).split(" ").filter(Boolean);
  if (!terms.length) return false;
  const hay = norm(`${c.name ?? ""} ${c.code ?? ""} ${c.address ?? ""}`);
  return terms.every((t) => hay.includes(t));
}

/** Lado a lado; o APP não separa condomínio/unidade, então ambos comparam com o nome do imóvel. */
export function compareProperty(local: LocalPropertyView, app: AppPropertyCandidate): LinkComparisonRow[] {
  const appName = norm(app.name);
  const contains = (v: string | null) => !norm(v) || !appName ? norm(v) !== appName : appName.includes(norm(v));
  return [
    { key: "condominium", label: "Condomínio", local: local.condominium, app: app.name, differs: local.condominium ? !contains(local.condominium) : !!app.name },
    { key: "unit", label: "Unidade", local: local.unit, app: app.code ?? app.name, differs: local.unit ? !(contains(local.unit) || norm(app.code).includes(norm(local.unit))) : true },
    { key: "address", label: "Endereço", local: local.address, app: app.address, differs: norm(local.address) !== norm(app.address) && !(norm(app.address) && norm(local.address).includes(norm(app.address))) },
  ];
}

export type LinkDecision = { ok: true } | { ok: false; reason: "linked_elsewhere" | "needs_ack" | "same_already" };
export function decideLink(input: { currentCoreId: string | null; candidateId: string; linkedToOtherCode: string | null; differences: number; acknowledged: boolean }): LinkDecision {
  if (input.linkedToOtherCode) return { ok: false, reason: "linked_elsewhere" };
  if (input.currentCoreId === input.candidateId) return { ok: false, reason: "same_already" };
  if (input.differences > 0 && !input.acknowledged) return { ok: false, reason: "needs_ack" };
  return { ok: true };
}

/** Ativo exige vínculo; Validação e etapas anteriores não. */
export const requiresAppLink = (status: string) => status === "ativo";
