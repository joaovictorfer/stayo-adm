import { describe, expect, it } from "vitest";

import { countPreparationReview } from "./opportunity-review";

describe("countPreparationReview", () => {
  it("separa itens conferidos de faltantes oficiais", () => {
    const result = countPreparationReview(
      [
        { inventory_answer: "tenho" },
        { inventory_answer: "nao_tenho" },
        { inventory_answer: "nao_aplicavel" },
        { inventory_answer: null },
      ],
      [
        { required_qty: 2, existing_qty: 1, status: "pendente" },
        { required_qty: 1, existing_qty: 1, status: "instalado" },
        { required_qty: 1, existing_qty: 0, status: "nao_aplicavel" },
      ],
    );

    expect(result).toEqual({ checked: 3, missing: 1 });
  });

  it("mantém zero quando ainda não houve conferência nem falta", () => {
    expect(
      countPreparationReview(
        [{ inventory_answer: null }],
        [{ required_qty: 0, existing_qty: 0, status: "pendente" }],
      ),
    ).toEqual({ checked: 0, missing: 0 });
  });
});
