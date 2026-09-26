import { describe, expect, it } from "vitest";

import { isValidPurchaseUrl, matchesFilter, rowStatus, summarizeGuide, validateImage } from "./guides";

const r = (o: Partial<Parameters<typeof rowStatus>[0]>) => ({
  recommended: 6,
  answer: null,
  quantity: null,
  review: null,
  confirmedQuantity: null,
  ...o,
});

describe("guia de utensílios", () => {
  it("classifica a situação", () => {
    expect(rowStatus(r({}))).toBe("nao_informado");
    expect(rowStatus(r({ answer: "ja_tenho", quantity: 4, review: "pendente" }))).toBe("confirmar");
    expect(rowStatus(r({ answer: "ja_tenho", quantity: 4, review: "confirmado", confirmedQuantity: 4 }))).toBe("faltando");
    expect(rowStatus(r({ answer: "ja_comprei", quantity: 6, review: "confirmado", confirmedQuantity: 6 }))).toBe("concluido");
    expect(matchesFilter(r({ answer: "ja_tenho", review: "pendente" }), "confirmar")).toBe(true);
  });
  it("resume", () => {
    const s = summarizeGuide([r({}), r({ answer: "ja_tenho", review: "pendente" }), r({ answer: "ja_tenho", review: "confirmado", confirmedQuantity: 6 })]);
    expect(s).toEqual({ total: 3, confirmadas: 1, aConfirmar: 1, pendentes: 1 });
  });
  it("valida link e imagem", () => {
    expect(isValidPurchaseUrl("https://loja.com/x")).toBe(true);
    expect(isValidPurchaseUrl("javascript:alert(1)")).toBe(false);
    expect(isValidPurchaseUrl("")).toBe(true);
    expect(validateImage({ type: "image/png", size: 100, name: "a.png" })).toBeNull();
    expect(validateImage({ type: "application/pdf", size: 100, name: "a.pdf" })).toBeTruthy();
    expect(validateImage({ type: "image/png", size: 6e6, name: "a.png" })).toBeTruthy();
  });
});
