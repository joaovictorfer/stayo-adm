import { describe, expect, it } from "vitest";

import { summarizeSupplierCategory } from "./property-supplier-summary";
import type { SupplierCatalogItem, SupplierEntry } from "./property-suppliers";

const catalog: SupplierCatalogItem[] = [
  { id: "catalog-1", name: "ON Instaladora", specialties: ["ar_condicionado"], status: "approved" },
];

const entry = (patch: Partial<SupplierEntry> = {}): SupplierEntry => ({
  id: "entry-1",
  categoryKey: "ar_condicionado",
  answer: "catalog",
  catalogId: "catalog-1",
  otherName: null,
  role: "instalou",
  phone: null,
  service: null,
  approxDate: null,
  notes: null,
  source: "admin",
  ...patch,
});

describe("summarizeSupplierCategory", () => {
  it("shows an empty category as not informed", () => {
    expect(summarizeSupplierCategory([], catalog)).toEqual({
      state: "not_informed",
      stateLabel: "Não informado",
      primary: null,
      secondary: null,
    });
  });

  it("shows an admin catalog entry as defined", () => {
    expect(summarizeSupplierCategory([entry()], catalog)).toMatchObject({
      state: "defined",
      stateLabel: "Definido",
      primary: "ON Instaladora",
    });
  });

  it("keeps not applicable explicit", () => {
    expect(
      summarizeSupplierCategory([entry({ answer: "not_applicable", catalogId: null })], catalog),
    ).toMatchObject({ state: "not_applicable", stateLabel: "Não se aplica" });
  });

  it("maps unknown to a confirmation state", () => {
    expect(
      summarizeSupplierCategory([entry({ answer: "unknown", catalogId: null })], catalog),
    ).toMatchObject({
      state: "to_confirm",
      stateLabel: "A confirmar",
      primary: "Não sei informar",
    });
  });

  it("keeps an owner answer visible but pending review", () => {
    expect(summarizeSupplierCategory([entry({ source: "owner" })], catalog)).toMatchObject({
      state: "to_confirm",
      stateLabel: "A confirmar",
      primary: "ON Instaladora",
    });
  });

  it("flags an unnamed other company for confirmation", () => {
    expect(
      summarizeSupplierCategory(
        [entry({ answer: "other", catalogId: null, otherName: null })],
        catalog,
      ),
    ).toMatchObject({
      state: "to_confirm",
      stateLabel: "A confirmar",
      primary: "Outra empresa — nome pendente",
    });
  });

  it("shows a named other company as defined", () => {
    expect(
      summarizeSupplierCategory(
        [entry({ answer: "other", catalogId: null, otherName: "Casa X" })],
        catalog,
      ),
    ).toMatchObject({ state: "defined", stateLabel: "Definido", primary: "Casa X" });
  });

  it("summarizes multiple companies without duplicating categories", () => {
    expect(
      summarizeSupplierCategory(
        [entry(), entry({ id: "entry-2", answer: "other", catalogId: null, otherName: "Casa X" })],
        catalog,
      ),
    ).toMatchObject({
      state: "defined",
      primary: "ON Instaladora",
      secondary: "+ 1 empresa",
    });
  });
});
