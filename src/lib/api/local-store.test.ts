import { describe, expect, it } from "vitest";

import { proposalItemTotal } from "./local-store";

describe("proposalItemTotal", () => {
  it("multiplica quantidade por valor unitário e subtrai o desconto", () => {
    expect(proposalItemTotal({ quantity: 2, unitValue: 100, discount: 20 })).toBe(180);
  });

  it("nunca fica negativo mesmo com desconto maior que o subtotal", () => {
    expect(proposalItemTotal({ quantity: 1, unitValue: 50, discount: 999 })).toBe(0);
  });

  it("zera quando quantidade é zero", () => {
    expect(proposalItemTotal({ quantity: 0, unitValue: 100, discount: 0 })).toBe(0);
  });
});
