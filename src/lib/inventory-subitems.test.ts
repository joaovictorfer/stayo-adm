import { describe, expect, it } from "vitest";
import { INVENTORY_SUBITEMS, inventorySubItemsFor, mergeSubAnswer, subAnswerFor } from "./inventory-subitems";

describe("inventorySubItemsFor", () => {
  it("jogo de jantar tem os quatro pratos pedidos", () => {
    expect(inventorySubItemsFor("Jogo de jantar").map((s) => s.label)).toEqual([
      "Prato de sobremesa",
      "Prato fundo",
      "Prato raso",
      "Souplast",
    ]);
  });

  it("itens sem subitens devolvem lista vazia", () => {
    expect(inventorySubItemsFor("Micro-ondas")).toEqual([]);
    expect(INVENTORY_SUBITEMS["micro_ondas"]).toBeUndefined();
  });
});

describe("mergeSubAnswer", () => {
  it("grava a resposta e preserva as outras", () => {
    const next = mergeSubAnswer({ prato_raso: "tenho" }, "prato_fundo", "nao_tenho");
    expect(next).toEqual({ prato_raso: "tenho", prato_fundo: "nao_tenho" });
  });

  it("remover a resposta limpa a chave e não deixa objeto vazio", () => {
    expect(mergeSubAnswer({ prato_raso: "tenho" }, "prato_raso", null)).toBeNull();
    expect(subAnswerFor(mergeSubAnswer({ souplast: "tenho" }, "souplast", null), "souplast")).toBeNull();
  });

  it("lê resposta ausente como nula", () => {
    expect(subAnswerFor(null, "prato_raso")).toBeNull();
    expect(subAnswerFor({ prato_raso: null }, "prato_raso")).toBeNull();
  });
});
