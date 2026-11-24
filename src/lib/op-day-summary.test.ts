import { describe, expect, it } from "vitest";
import { staysForDay } from "./op-day-summary";
import type { CalendarStay } from "./op-calendar";

const stays: CalendarStay[] = [
  { id: "arrival", implementationId: "p1", guest: "Ana", checkin: "2026-11-24", checkout: "2026-11-27" },
  { id: "departure", implementationId: "p2", guest: "Bia", checkin: "2026-11-21", checkout: "2026-11-24" },
  { id: "inside", implementationId: "p3", guest: "Caio", checkin: "2026-11-23", checkout: "2026-11-26" },
  { id: "tomorrow", implementationId: "p4", guest: "Davi", checkin: "2026-11-25", checkout: "2026-11-28" },
];
describe("resumo operacional por dia", () => {
  it("separa as chegadas do dia das reservas futuras", () => {
    expect(staysForDay(stays, "2026-11-24", "chegadas").map(s => s.id)).toEqual(["arrival"]);
    expect(staysForDay(stays, "2026-11-25", "chegadas").map(s => s.id)).toEqual(["tomorrow"]);
  });
  it("separa as saídas pela data de checkout", () => {
    expect(staysForDay(stays, "2026-11-24", "saidas").map(s => s.id)).toEqual(["departure"]);
  });
  it("inclui chegadas e saídas na visão de hospedagens previstas do dia sem afirmar presença física", () => {
    expect(staysForDay(stays, "2026-11-24", "em_casa").map(s => s.id)).toEqual(["arrival", "departure", "inside"]);
    expect(staysForDay(stays, "2026-11-25", "em_casa").map(s => s.id)).toEqual(["arrival", "inside", "tomorrow"]);
  });
});