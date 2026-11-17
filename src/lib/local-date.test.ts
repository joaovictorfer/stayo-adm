import { describe, expect, it } from "vitest";
import { addDaysISO, localISODate, longDayLabel } from "./local-date";
describe("datas no fuso de Gramado", () => {
  it("01:48 em Gramado (04:48 UTC) ainda é o mesmo dia", () => {
    expect(localISODate(new Date("2026-11-17T04:48:00Z"))).toBe("2026-11-17");
    expect(localISODate(new Date("2026-11-17T02:30:00Z"))).toBe("2026-11-16");
  });
  it("soma dias atravessando o mês", () => {
    expect(addDaysISO("2026-11-28", 6)).toBe("2026-12-04");
  });
  it("rótulo em português", () => {
    expect(longDayLabel("2026-11-17")).toBe("terça-feira, 17 de novembro");
  });
});
