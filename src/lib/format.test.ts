import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formata em BRL por padrão", () => {
    expect(formatMoney(1234.5)).toBe("R$ 1.234,50");
  });

  it("aceita outra moeda", () => {
    expect(formatMoney(10, "USD")).toBe("US$ 10,00");
  });

  it("retorna null para valor nulo ou indefinido", () => {
    expect(formatMoney(null)).toBeNull();
    expect(formatMoney(undefined)).toBeNull();
  });
});
