import {
  entryDisplayName,
  isPendingOther,
  type SupplierCatalogItem,
  type SupplierEntry,
} from "./property-suppliers";

export type SupplierCategoryState = "defined" | "not_informed" | "not_applicable" | "to_confirm";

export interface SupplierCategorySummary {
  state: SupplierCategoryState;
  stateLabel: "Definido" | "Não informado" | "Não se aplica" | "A confirmar";
  primary: string | null;
  secondary: string | null;
}

export function summarizeSupplierCategory(
  entries: SupplierEntry[],
  catalog: SupplierCatalogItem[],
): SupplierCategorySummary {
  if (entries.length === 0) {
    return {
      state: "not_informed",
      stateLabel: "Não informado",
      primary: null,
      secondary: null,
    };
  }

  const companies = entries.filter((entry) => entry.answer === "catalog" || entry.answer === "other");
  const notApplicable = entries.find((entry) => entry.answer === "not_applicable");
  const unknown = entries.find((entry) => entry.answer === "unknown");

  if (companies.length === 0 && notApplicable) {
    return {
      state: "not_applicable",
      stateLabel: "Não se aplica",
      primary: null,
      secondary: null,
    };
  }

  if (companies.length === 0 && unknown) {
    return {
      state: "to_confirm",
      stateLabel: "A confirmar",
      primary: "Não sei informar",
      secondary: unknown.source === "owner" ? "Informado pelo proprietário" : null,
    };
  }

  if (companies.length > 0) {
    const first = companies[0]!;
    const needsConfirmation = companies.some(
      (entry) => isPendingOther(entry) || entry.source === "owner",
    );

    return {
      state: needsConfirmation ? "to_confirm" : "defined",
      stateLabel: needsConfirmation ? "A confirmar" : "Definido",
      primary: entryDisplayName(first, catalog),
      secondary:
        companies.length > 1
          ? `+ ${companies.length - 1} ${companies.length === 2 ? "empresa" : "empresas"}`
          : null,
    };
  }

  return {
    state: "not_informed",
    stateLabel: "Não informado",
    primary: null,
    secondary: null,
  };
}
