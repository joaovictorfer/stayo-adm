import { describe, expect, it } from "vitest";
import {
  newEntry,
  summarizeSupplierCategory,
  type SupplierCatalogItem,
  type SupplierEntry,
} from "./property-suppliers";

const catalog: SupplierCatalogItem[] = [
  { id: "catalog-1", name: "ON Instaladora", specialties: ["ar_condicionado"], status: "approved" },
];

const entry = (patch: Partial<SupplierEntry>): SupplierEntry => ({
  ...newEntry("ar_condicionado", "other", "admin"),
  otherName: "Casa X",
  ...patch,
});

describe("summarizeSupplierCategory", () => {
  it("identifica categoria ainda não informada", () => {
    expect(summarizeSupplierCategory([], catalog)).toMatchObject({ state: "not_informed", stateLabel: "Não informado" });
  });

  it("resume empresa definida do catálogo", () => {
    expect(summarizeSupplierCategory([entry({ answer: "catalog", catalogId: "catalog-1" })], catalog)).toEqual({
      state: "defined",
      stateLabel: "Definido",
      description: "ON Instaladora",
    });
  });

  it("mantém não se aplica como estado próprio", () => {
    expect(summarizeSupplierCategory([entry({ answer: "not_applicable", otherName: null })], catalog)).toMatchObject({
      state: "not_applicable",
      stateLabel: "Não se aplica",
    });
  });

  it("marca resposta do proprietário para confirmação", () => {
    expect(summarizeSupplierCategory([entry({ source: "owner" })], catalog)).toMatchObject({ state: "to_confirm", stateLabel: "A confirmar" });
  });

  it("marca empresa manual sem nome para confirmação", () => {
    expect(summarizeSupplierCategory([entry({ otherName: null })], catalog)).toMatchObject({ state: "to_confirm", description: "Outra empresa — nome pendente" });
  });

  it("resume múltiplas empresas sem ocultar a quantidade adicional", () => {
    expect(summarizeSupplierCategory([entry({}), entry({ otherName: "Casa Y" })], catalog).description).toBe("Casa X +1");
  });
});