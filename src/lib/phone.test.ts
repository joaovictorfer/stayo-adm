import { describe, expect, it } from "vitest";

import { formatBrazilPhone, isValidBrazilPhone, normalizeBrazilPhone, sameBrazilPhone } from "./phone";

describe("telefone brasileiro", () => {
  it("normaliza números nacionais e com código do país", () => {
    expect(normalizeBrazilPhone("(54) 99999-1234")).toBe("54999991234");
    expect(normalizeBrazilPhone("+55 54 99999-1234")).toBe("54999991234");
  });

  it("aplica máscara para celular e telefone fixo", () => {
    expect(formatBrazilPhone("54999991234")).toBe("(54) 99999-1234");
    expect(formatBrazilPhone("5433331234")).toBe("(54) 3333-1234");
  });

  it("valida DDD e tamanho do telefone", () => {
    expect(isValidBrazilPhone("(54) 99999-1234")).toBe(true);
    expect(isValidBrazilPhone("(54) 3333-1234")).toBe(true);
    expect(isValidBrazilPhone("(00) 99999-1234")).toBe(false);
  });

  it("compara telefones independentemente da formatação", () => {
    expect(sameBrazilPhone("+55 54 99999-1234", "(54) 99999-1234")).toBe(true);
  });
});