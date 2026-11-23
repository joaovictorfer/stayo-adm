import { describe, expect, it } from "vitest";
import { addDaysISO, localISODate, longDayLabel, formatBrasiliaDateTime, formatBrasiliaDate, formatCalendarDate, brazilianDateToISO, validTime24 } from "./local-date";
describe("datas no fuso de Gramado", () => {
  it("01:48 em Gramado (04:48 UTC) ainda é o mesmo dia", () => {
    expect(localISODate(new Date("2026-11-17T04:48:00Z"))).toBe("2026-11-17");
    expect(localISODate(new Date("2026-11-17T02:30:00Z"))).toBe("2026-11-16");
  });
  it("soma dias atravessando o mês", () => {
    expect(addDaysISO("2026-11-28", 6)).toBe("2026-12-04");
  });
  it("rótulo em português", () => {
    expect(longDayLabel("2026-11-17")).toBe("Terça-feira, 17 de novembro");
  });
  it("apresenta o mesmo instante em Brasília, sem virar o dia em UTC", () => {
    expect(formatBrasiliaDateTime("2026-11-23T01:31:00Z")).toBe("22/11/2026 às 22:31");
    expect(formatBrasiliaDateTime("2026-11-22T22:31:00-03:00")).toBe("22/11/2026 às 22:31");
    expect(formatBrasiliaDate("2026-11-23T01:31:00Z")).toBe("22/11/2026");
  });
  it("usa 24 horas à meia-noite em Brasília", () => {
    expect(formatBrasiliaDateTime("2026-11-23T03:00:00Z")).toBe("23/11/2026 às 00:00");
  });
  it("mantém dias de planejamento sem conversão de fuso e usa DD/MM/AAAA", () => {
    expect(formatCalendarDate("2026-11-22")).toBe("22/11/2026");
    expect(brazilianDateToISO("22/11/2026")).toBe("2026-11-22");
  });
  it("rejeita datas impossíveis sem normalizar silenciosamente", () => {
    expect(brazilianDateToISO("31/11/2026")).toBeNull();
    expect(brazilianDateToISO("29/02/2024")).toBe("2024-02-29");
    expect(brazilianDateToISO("29/02/2026")).toBeNull();
  });
  it("não inventa um fuso para um instante ausente ou sem offset", () => {
    expect(formatBrasiliaDateTime(null)).toBe("Não informado");
    expect(formatBrasiliaDateTime("2026-11-23T01:31:00")).toBe("Não informado");
    expect(formatCalendarDate("2026-13-22")).toBe("Não informado");
  });
  it("aceita somente horários de 24 horas válidos", () => {
    expect(validTime24("00:00")).toBe(true);
    expect(validTime24("23:59")).toBe(true);
    expect(validTime24("24:00")).toBe(false);
    expect(validTime24("11:60")).toBe(false);
  });
});
