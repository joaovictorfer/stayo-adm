import { describe, expect, it } from "vitest";
import { cleaningWindow, suggestedCleaningDate, validCleaningDate, type CalendarStay } from "./op-calendar";
const stay: CalendarStay = { id: "a", implementationId: "p", guest: "Ana", checkin: "2026-11-19", checkout: "2026-11-22" };
describe("janela operacional entre reservas", () => {
  it("alerta out-in quando saída e entrada são no mesmo dia", () => {
    const w = cleaningWindow(stay, [stay, { ...stay, id: "b", checkin: "2026-11-22", checkout: "2026-11-25" }]);
    expect(w.kind).toBe("out_in"); expect(validCleaningDate(w, "2026-11-21")).toBe(false); expect(validCleaningDate(w, "2026-11-22")).toBe(true); expect(validCleaningDate(w, "2026-11-23")).toBe(false);
  });
  it("permite organizar limpeza nos dias livres antes da entrada", () => {
    const w = cleaningWindow(stay, [stay, { ...stay, id: "b", checkin: "2026-11-26", checkout: "2026-11-29" }]);
    expect(w.kind).toBe("flexivel"); expect(suggestedCleaningDate(w, "2026-11-19")).toBe("2026-11-25"); expect(validCleaningDate(w, "2026-11-24")).toBe(true); expect(validCleaningDate(w, "2026-11-27")).toBe(false);
  });
  it("não mistura imóveis e deixa prazo aberto sem próxima entrada", () => {
    const w = cleaningWindow(stay, [stay, { ...stay, id: "b", implementationId: "other", checkin: "2026-11-22" }]);
    expect(w.kind).toBe("sem_entrada"); expect(w.end).toBeNull(); expect(validCleaningDate(w, "2026-11-30")).toBe(true);
  });
});