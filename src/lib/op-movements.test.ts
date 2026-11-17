import { describe, expect, it } from "vitest";
import { buildMovements, type MovementReservation } from "./op-movements";
const r = (id: string, imp: string, checkin: string, checkout: string): MovementReservation => ({ id, implementationId: imp, property: imp, guest: null, checkin, checkout, channel: null });
describe("entradas e saídas", () => {
  it("saída com entrada no mesmo dia é virada crítica", () => {
    const m = buildMovements([r("a", "P", "2026-11-10", "2026-11-17"), r("b", "P", "2026-11-17", "2026-11-20")], "2026-11-17", "2026-11-17");
    expect(m.map((x) => [x.type, x.turnover])).toEqual([["checkout", "mesmo_dia"], ["checkin", null]]);
  });
  it("entrada no dia seguinte é janela curta", () => {
    const m = buildMovements([r("a", "P", "2026-11-10", "2026-11-17"), r("b", "P", "2026-11-18", "2026-11-20")], "2026-11-17", "2026-11-17");
    expect(m[0]!.turnover).toBe("dia_seguinte");
  });
  it("entrada de outro imóvel não conta como virada", () => {
    const m = buildMovements([r("a", "P", "2026-11-10", "2026-11-17"), r("b", "Q", "2026-11-17", "2026-11-20")], "2026-11-17", "2026-11-17");
    expect(m.find((x) => x.type === "checkout")!.turnover).toBeNull();
  });
});
