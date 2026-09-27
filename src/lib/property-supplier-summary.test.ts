import { describe, expect, it } from "vitest";

import type { SupplierCatalogItem, SupplierEntry } from "./property-suppliers";
import { supplierCategorySummary } from "./property-supplier-summary";

const catalog: SupplierCatalogItem[] = [
  {
    id: "catalog-1",
    name: "ON Instaladora",
    specialties: ["ar_condicionado"],
    status: "approved",
  },
];

function entry(patch: Partial<SupplierEntry> = {}): SupplierEntry {
  return {
    id: crypto.randomUUID(),
    categoryKey: "ar_condicionado",
    answer: "catalog",
    catalogId: "catalog-1",
    otherName: null,
    role: null,
    phone: null,
    service: null,
    approxDate: null,
    notes: null,
    source: "admin",
    ...patch,
  };
}

describe("supplierCategorySummary", () => {
  it("marks an unanswered category as not informed", () => {
    expect(supplierCategorySummary("hidraulica", [], catalog)).toEqual({
      state: "empty",
      stateLabel: "Não informado",
      display: "Não informado",
      companyCount: 0,
    });
  });

  it("marks a catalog supplier as defined", () => {
    expect(supplierCategorySummary("ar_condicionado", [entry()], catalog)).toMatchObject({
      state: "defined",
      stateLabel: "Definido",
      display: "ON Instaladora",
      companyCount: 1,
    });
  });

  it("marks a named manual supplier as defined", () => {
    const summary = supplierCategorySummary(
      "ar_condicionado",
      [entry({ answer: "other", catalogId: null, otherName: "Clima Serra" })],
      catalog,
    );
    expect(summary.state).toBe("defined");
    expect(summary.display).toBe("Clima Serra");
  });

  it("marks a manual supplier without a name as awaiting confirmation", () => {
    const summary = supplierCategorySummary(
      "ar_condicionado",
      [entry({ answer: "other", catalogId: null, otherName: null })],
      catalog,
    );
    expect(summary.state).toBe("confirm");
    expect(summary.stateLabel).toBe("A confirmar");
  });

  it("maps don't know to awaiting confirmation", () => {
    const summary = supplierCategorySummary(
      "ar_condicionado",
      [entry({ answer: "unknown", catalogId: null })],
      catalog,
    );
    expect(summary).toMatchObject({
      state: "confirm",
      stateLabel: "A confirmar",
      display: "Não sei informar",
    });
  });

  it("preserves not applicable as its own state", () => {
    const summary = supplierCategorySummary(
      "ar_condicionado",
      [entry({ answer: "not_applicable", catalogId: null })],
      catalog,
    );
    expect(summary).toMatchObject({
      state: "not_applicable",
      stateLabel: "Não se aplica",
      display: "Não se aplica",
    });
  });

  it("summarizes multiple companies without duplicating the category", () => {
    const summary = supplierCategorySummary(
      "ar_condicionado",
      [
        entry(),
        entry({ id: crypto.randomUUID(), answer: "other", catalogId: null, otherName: "Clima Serra" }),
      ],
      catalog,
    );
    expect(summary).toMatchObject({
      state: "defined",
      display: "ON Instaladora + 1",
      companyCount: 2,
    });
  });
});
