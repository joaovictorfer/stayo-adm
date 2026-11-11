import { describe, it, expect } from "vitest";
import { linenNeeds, allocateLinen, validateLinen, type LinenPayload } from "./linen";
describe("enxoval", () => {
  it("B502 mantém uma queen, duas solteiro e um pillow de união sem converter em queen", () => {
    const n = linenNeeds({ rooms: [
      {id:"q1",name:"Quarto 01",kind:"quarto",items:{camas:{opts:{Queen:1}}},custom:[]},
      {id:"q2",name:"Quarto 02",kind:"quarto",items:{camas:{opts:{Solteiro:2}},unificacao_solteiros:{on:true}},custom:[]},
    ]});
    expect(n.find(i=>i.room==="Quarto 01"&&i.name==="Lençol com elástico")?.required).toBe(2);
    expect(n.find(i=>i.room==="Quarto 02"&&i.name==="Lençol com elástico")?.required).toBe(4);
    expect(n.find(i=>i.name==="Pillow top de unificação")?.required).toBe(1);
    expect(n.filter(i=>i.room==="Quarto 02"&&i.size==="Queen")).toHaveLength(0);
  });
  it("duplica todas as peças por cama para troca", () => {
    const n = linenNeeds({
      rooms: [
        {
          id: "a",
          name: "Quarto",
          kind: "quarto",
          items: { camas: { opts: { Solteiro: 2, Queen: 1 } } },
          custom: [],
        },
      ],
    });
    expect(n.find((i) => i.name === "Lençol com elástico" && i.size === "Solteiro")?.required).toBe(
      4,
    );
    expect(n.find((i) => i.name === "Edredom" && i.size === "Queen")?.required).toBe(2);
  });
  const p: LinenPayload = {
    supplier: "Império Sul",
    number: "05580",
    date: "2026-11-10",
    delivery: null,
    discountCents: 17585,
    freightCents: 0,
    totalCents: 568567,
    notes: "",
    items: [
      {
        code: "",
        name: "Enxoval",
        size: "",
        color: "",
        category: "",
        quantity: 1,
        unitCents: 586152,
      },
    ],
  };
  it("fecha o pedido 05580 com desconto de 175,85", () => {
    expect(validateLinen(p).totalCents).toBe(568567);
    expect(allocateLinen(p).reduce((a, b) => a + b, 0)).toBe(568567);
  });
  it("não confirma total incorreto", () =>
    expect(() => validateLinen({ ...p, totalCents: 586152 })).toThrow());
  it("rateia centavos sem perder o total", () => {
    const items = [1, 2, 3].map((n) => ({
      code: "",
      size: "",
      color: "",
      category: "",
      name: "Item",
      quantity: 1,
      unitCents: n,
    }));
    expect(allocateLinen({ ...p, items, totalCents: 5, discountCents: 1 })).toEqual([1, 2, 2]);
  });
});
