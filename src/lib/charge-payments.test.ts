import { describe, it, expect } from "vitest";
import { amountFor, buildOrder } from "./charge-payments";
const items = [{ id: "1", description: "Limpeza comercial", quantity: 1, unitCents: 25000 }];
const payer = { name: "Cliente Teste", document: "52619915368", phone: "85992591556", email: "a@b.com" };
describe("valor cobrado", () => {
  it("Pix cobra o subtotal integral", () => expect(amountFor(items, "pix")).toBe(25000));
  it("cartão cobra subtotal + 5%", () => expect(amountFor(items, "card")).toBe(26250));
  it("pedido de cartão usa o total com acréscimo em 1x", () => {
    const o = buildOrder({ code: "COB-1", method: "card", amount: 26250, payer, successUrl: "https://x", chargeId: "c" });
    expect(o.items[0]!.amount).toBe(26250);
    expect((o.payments[0] as { checkout: { credit_card: { installments: { total: number }[] } } }).checkout.credit_card.installments[0]!.total).toBe(26250);
  });
});
