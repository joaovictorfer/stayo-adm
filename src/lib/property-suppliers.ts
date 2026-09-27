// Fornecedores e instalações do imóvel — tipos e regras compartilhadas entre a ficha
// administrativa e o cadastro do proprietário.

export type SupplierAnswer = "catalog" | "other" | "unknown" | "not_applicable";
export type SupplierRole = "forneceu" | "instalou" | "forneceu_instalou" | "atende";

export interface SupplierCategory {
  key: string;
  label: string;
  custom?: boolean;
}

export interface SupplierCatalogItem {
  id: string;
  name: string;
  specialties: string[];
  status?: "suggested" | "approved" | "archived";
}

export interface SupplierEntry {
  id: string;
  categoryKey: string;
  answer: SupplierAnswer;
  catalogId: string | null;
  catalogName?: string | null;
  otherName: string | null;
  role: SupplierRole | null;
  phone: string | null;
  service: string | null;
  approxDate: string | null;
  notes: string | null;
  source: "owner" | "admin";
  locked?: boolean;
  adminNotes?: string | null;
  reviewedAt?: string | null;
}

export const DEFAULT_SUPPLIER_CATEGORIES: SupplierCategory[] = [
  { key: "ar_condicionado", label: "Ar-condicionado e climatização" },
  { key: "hidraulica", label: "Hidráulica" },
  { key: "eletrica", label: "Elétrica" },
  { key: "moveis", label: "Móveis e marcenaria" },
  { key: "gas", label: "Gás" },
  { key: "aquecimento", label: "Aquecimento de água e calefação" },
];

export const SPECIALTY_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_SUPPLIER_CATEGORIES.map((c) => [c.key, c.label]),
);

export const SUPPLIER_ROLE_LABELS: Record<SupplierRole, string> = {
  forneceu: "Forneceu",
  instalou: "Instalou",
  forneceu_instalou: "Forneceu e instalou",
  atende: "Faz a manutenção",
};

export const PENDING_OTHER_NAME = "Outra empresa — nome pendente";

export type SupplierCategoryState = "defined" | "not_informed" | "not_applicable" | "to_confirm";

export interface SupplierCategorySummary {
  state: SupplierCategoryState;
  stateLabel: "Definido" | "Não informado" | "Não se aplica" | "A confirmar";
  description: string;
}

export function entryDisplayName(e: SupplierEntry, catalog: SupplierCatalogItem[]): string {
  if (e.answer === "unknown") return "Não sei informar";
  if (e.answer === "not_applicable") return "Não se aplica";
  if (e.answer === "catalog")
    return (
      e.catalogName ?? catalog.find((c) => c.id === e.catalogId)?.name ?? "Empresa do catálogo"
    );
  const name = e.otherName?.trim();
  return name ? name : PENDING_OTHER_NAME;
}

export function isPendingOther(e: SupplierEntry) {
  return e.answer === "other" && !e.otherName?.trim();
}

export function summarizeSupplierCategory(
  entries: SupplierEntry[],
  catalog: SupplierCatalogItem[],
): SupplierCategorySummary {
  if (entries.length === 0) {
    return {
      state: "not_informed",
      stateLabel: "Não informado",
      description: "Nenhuma informação",
    };
  }

  const companies = entries.filter(
    (entry) => entry.answer === "catalog" || entry.answer === "other",
  );
  const status = entries.find(
    (entry) => entry.answer === "unknown" || entry.answer === "not_applicable",
  );

  if (companies.length > 0) {
    const first = companies[0];
    if (!first) {
      return {
        state: "not_informed",
        stateLabel: "Não informado",
        description: "Nenhuma informação",
      };
    }
    const extra = companies.length - 1;
    const description = `${entryDisplayName(first, catalog)}${extra > 0 ? ` +${extra}` : ""}`;
    const needsConfirmation = companies.some(
      (entry) => entry.source === "owner" || isPendingOther(entry),
    );
    return {
      state: needsConfirmation ? "to_confirm" : "defined",
      stateLabel: needsConfirmation ? "A confirmar" : "Definido",
      description,
    };
  }

  if (status?.answer === "not_applicable") {
    return { state: "not_applicable", stateLabel: "Não se aplica", description: "Não se aplica" };
  }

  return { state: "not_informed", stateLabel: "Não informado", description: "Não informado" };
}

export function mergeCategories(custom: SupplierCategory[]): SupplierCategory[] {
  const keys = new Set(DEFAULT_SUPPLIER_CATEGORIES.map((c) => c.key));
  return [
    ...DEFAULT_SUPPLIER_CATEGORIES,
    ...custom.filter((c) => !keys.has(c.key)).map((c) => ({ ...c, custom: true })),
  ];
}

export function slugCategory(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `custom_${base || "categoria"}`;
}

export function newEntry(
  categoryKey: string,
  answer: SupplierAnswer,
  source: "owner" | "admin",
): SupplierEntry {
  return {
    id: crypto.randomUUID(),
    categoryKey,
    answer,
    catalogId: null,
    otherName: null,
    role: null,
    phone: null,
    service: null,
    approxDate: null,
    notes: null,
    source,
  };
}
