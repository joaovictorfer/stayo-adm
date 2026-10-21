export interface ChargeItem { id: string; description: string; quantity: number; unitCents: number }
export type ChargeStatus = "draft" | "open" | "paid" | "cancelled";
export interface DemoCharge {
  id: string; code: string; title: string; recipient: string; email: string;
  property: string | null; presentedProperty: string | null; due: string; issued: string;
  competence: string; notes: string; internalNotes: string; items: ChargeItem[];
  status: ChargeStatus; history: string[];
}
export const demoProperties = ["Araucárias · 105", "Jardim da Serra · 204"];
export function chargeTotals(items: ChargeItem[]) {
  const subtotal = items.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.unitCents) || item.unitCents < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error("Item inválido");
    return sum + item.quantity * item.unitCents;
  }, 0);
  if (!Number.isSafeInteger(subtotal)) throw new Error("Valor inválido");
  const surcharge = Math.round(subtotal * 5 / 100);
  return { subtotal, pix: subtotal, surcharge, card: subtotal + surcharge };
}
export function linkDemoProperty(charge: DemoCharge, property: string | null): DemoCharge {
  return { ...charge, property, presentedProperty: charge.status === "draft" ? property : charge.presentedProperty,
    history: [...charge.history, property ? `Vínculo administrativo: ${property}` : "Vínculo administrativo removido"] };
}
export function canEditCharge(charge: DemoCharge) { return charge.status === "draft"; }
export function canCancelCharge(charge: DemoCharge) { return charge.status === "open" || charge.status === "draft"; }
export function isOverdue(charge: DemoCharge, today: string) { return charge.status === "open" && charge.due < today; }
export function makeDemoCharges(): DemoCharge[] {
  const base: DemoCharge = { id: "demo-1", code: "DEMO-001", title: "Limpeza pós-hospedagem", recipient: "Cliente demonstrativo", email: "cliente@example.com", property: demoProperties[0] ?? null, presentedProperty: demoProperties[0] ?? null, due: "2026-10-28", issued: "2026-10-21", competence: "2026-10", notes: "Limpeza realizada após uso do imóvel.", internalNotes: "Nota interna demonstrativa — não aparece ao destinatário.", items: [{ id: "item-1", description: "Limpeza pós-hospedagem", quantity: 1, unitCents: 25000 }], status: "open", history: ["Cobrança demonstrativa criada", "Apresentação demonstrativa publicada"] };
  return [base,
    { ...base, id: "demo-2", code: "DEMO-002", title: "Serviços de manutenção", recipient: "Destinatário avulso", property: null, presentedProperty: null, status: "draft", notes: "", history: ["Rascunho demonstrativo criado"], items: [{ id: "item-2", description: "Visita técnica", quantity: 1, unitCents: 18000 }] },
    { ...base, id: "demo-3", code: "DEMO-003", title: "Reposição de utensílios", recipient: "Cliente exemplo", due: "2026-10-15", items: [{ id: "item-3", description: "Reposição de utensílios", quantity: 2, unitCents: 9500 }] },
    { ...base, id: "demo-4", code: "DEMO-004", title: "Limpeza de preparação", status: "paid", due: "2026-10-10", history: ["Cobrança demonstrativa criada", "Pagamento fictício confirmado"] }];
}
export function newDemoCharge(index: number): DemoCharge {
  return { id: `local-${index}`, code: `DEMO-${String(index).padStart(3, "0")}`, title: "", recipient: "", email: "", property: null, presentedProperty: null, due: "2026-10-28", issued: "2026-10-21", competence: "2026-10", notes: "", internalNotes: "", items: [{ id: "first", description: "", quantity: 1, unitCents: 0 }], status: "draft", history: ["Rascunho demonstrativo criado"] };
}