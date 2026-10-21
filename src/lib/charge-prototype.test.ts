import { describe, expect, it } from "vitest";
import { canCancelCharge, canEditCharge, chargeTotals, isOverdue, linkDemoProperty, makeDemoCharges } from "./charge-prototype";

describe("regras de cobrança", () => {
  const item = { id: "1", description: "Limpeza", quantity: 1, unitCents: 25000 };
  it("Pix cobra o valor integral de R$ 250 sem acréscimo", () => { expect(chargeTotals([item]).pix).toBe(25000); });
  it("cartão acrescenta 5%: R$ 12,50 sobre R$ 250, total R$ 262,50", () => { expect(chargeTotals([item])).toMatchObject({ surcharge: 1250, card: 26250 }); });
  it("subtotal soma quantidade vezes valor de cada item", () => { expect(chargeTotals([item, { ...item, id: "2", quantity: 2, unitCents: 1000 }]).subtotal).toBe(27000); });
  it("acréscimo arredonda em centavos", () => { expect(chargeTotals([{ ...item, unitCents: 101 }]).card).toBe(106); });
  it("vínculo posterior preserva financeiro e destinatário publicados", () => {
    const charge = makeDemoCharges()[0]; if (!charge) throw new Error("Fixture ausente");
    const linked = linkDemoProperty(charge, "Outro imóvel");
    expect(linked.property).toBe("Outro imóvel"); expect(linked.items).toEqual(charge.items); expect(linked.recipient).toBe(charge.recipient); expect(linked.presentedProperty).toBe(charge.presentedProperty);
  });
  it("somente rascunho permite editar valores", () => { for (const charge of makeDemoCharges()) expect(canEditCharge(charge)).toBe(charge.status === "draft"); });
  it("cobrança paga não pode ser cancelada", () => { const charge = makeDemoCharges().find(c => c.status === "paid"); if (!charge) throw new Error("Fixture ausente"); expect(canCancelCharge(charge)).toBe(false); });
  it("vencimento não transforma pagamento em atraso", () => { const charge = makeDemoCharges().find(c => c.status === "paid"); if (!charge) throw new Error("Fixture ausente"); expect(isOverdue(charge, "2026-10-21")).toBe(false); });
});