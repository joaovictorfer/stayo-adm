import { describe, expect, it } from "vitest";
import { compositionDivergences, countsFromRooms, divergenceSnapshot, resolveField } from "./field-sources";

describe("selos e divergências do proprietário", () => {
  it("valor só no cadastro é Oficial; só no envio é Enviado; nenhum falta", () => {
    expect(resolveField("Ana", null).badge).toBe("oficial");
    expect(resolveField(null, "Ana").badge).toBe("enviado");
    expect(resolveField("", "").missing).toBe(true);
  });
  it("mesmo valor com formatação diferente não é divergência", () => {
    expect(resolveField("(54) 99140-3953", "5554991403953", "digits").divergence).toBeNull();
  });
  it("valores diferentes mostram os dois e mantêm o oficial", () => {
    const r = resolveField("ana@a.com", "ana@b.com", "email");
    expect(r.value).toBe("ana@a.com");
    expect(r.divergence).toEqual({ official: "ana@a.com", submitted: "ana@b.com", checking: false });
  });
  it("'Usar oficial' some com a divergência, mas volta se o envio mudar", () => {
    const stored = { decision: "usar_oficial" as const, snapshot: divergenceSnapshot("A", "B") };
    expect(resolveField("A", "B", "text", stored).divergence).toBeNull();
    expect(resolveField("A", "C", "text", stored).divergence).not.toBeNull();
  });
  it("'Conferir no local' mantém os dois valores marcados para conferência", () => {
    const stored = { decision: "conferir_local" as const, snapshot: divergenceSnapshot("A", "B") };
    expect(resolveField("A", "B", "text", stored).divergence?.checking).toBe(true);
  });
});

describe("composição: cadastro x coleta", () => {
  it("3 banheiros no cadastro e 2 na coleta gera divergência", () => {
    const collected = countsFromRooms([{ kind: "quarto", suite: true }, { kind: "quarto" }, { kind: "banheiro" }]);
    expect(collected).toEqual({ bedrooms: 2, bathrooms: 2, lavatories: 0 });
    const d = compositionDivergences({ bedrooms: 2, bathrooms: 3, lavatories: 0 }, collected);
    expect(d).toEqual([{ key: "bathrooms", label: "Banheiros", registered: 3, collected: 2 }]);
  });
  it("sem coleta ou campo vazio no cadastro não acusa divergência", () => {
    expect(compositionDivergences({ bedrooms: 2, bathrooms: 3, lavatories: null }, null)).toEqual([]);
    expect(compositionDivergences({ bedrooms: null, bathrooms: 2, lavatories: null }, { bedrooms: 3, bathrooms: 2, lavatories: 1 })).toEqual([]);
  });
});
