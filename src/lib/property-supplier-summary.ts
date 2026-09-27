import {
  entryDisplayName,
  isPendingOther,
  type SupplierCatalogItem,
  type SupplierEntry,
} from "./property-suppliers";

export type SupplierCategoryState = "defined" | "empty" | "not_applicable" | "confirm";

export const SUPPLIER_CATEGORY_STATE_LABELS: Record<SupplierCategoryState, string> = {
  defined: "Definido",
  empty: "Não informado",
  not_applicable: "Não se aplica",
  confirm: "A confirmar",
};

export interface SupplierCategorySummary {
  state: SupplierCategoryState;
  stateLabel: string;
  display: string;
  companyCount: number;
}

export function supplierCategorySummary(
  categoryKey: string,
  entries: SupplierEntry[],
  catalog: SupplierCatalogItem[],
): SupplierCategorySummary {
  const categoryEntries = entries.filter((entry) => entry.categoryKey === categoryKey);
  if (categoryEntries.length === 0) {
    return {
      state: "empty",
      stateLabel: SUPPLIER_CATEGORY_STATE_LABELS.empty,
      display: "Não informado",
      companyCount: 0,
    };
  }

  const companies = categoryEntries.filter(
    (entry) => entry.answer === "catalog" || entry.answer === "other",
  );
  const needsConfirmation = categoryEntries.some(
    (entry) => entry.answer === "unknown" || isPendingOther(entry),
  );
  const notApplicable = categoryEntries.some((entry) => entry.answer === "not_applicable");

  if (needsConfirmation) {
    const pendingCompany = companies.find(isPendingOther);
    return {
      state: "confirm",
      stateLabel: SUPPLIER_CATEGORY_STATE_LABELS.confirm,
      display:
        pendingCompany != null
          ? entryDisplayName(pendingCompany, catalog)
          : "Não sei informar",
      companyCount: companies.length,
    };
  }

  if (companies.length > 0) {
    const firstName = entryDisplayName(companies[0]!, catalog);
    return {
      state: "defined",
      stateLabel: SUPPLIER_CATEGORY_STATE_LABELS.defined,
      display:
        companies.length === 1 ? firstName : `${firstName} + ${companies.length - 1}`,
      companyCount: companies.length,
    };
  }

  if (notApplicable) {
    return {
      state: "not_applicable",
      stateLabel: SUPPLIER_CATEGORY_STATE_LABELS.not_applicable,
      display: "Não se aplica",
      companyCount: 0,
    };
  }

  return {
    state: "empty",
    stateLabel: SUPPLIER_CATEGORY_STATE_LABELS.empty,
    display: "Não informado",
    companyCount: 0,
  };
}
