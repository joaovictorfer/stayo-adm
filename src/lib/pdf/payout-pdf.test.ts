import { describe, expect, it } from "vitest";
import { computeStatement } from "../payout-statement";
import { payoutPdfCpf, payoutPdfAmount, payoutPdfReadiness, generatePayoutPdf, type PayoutPdfInput, type PayoutPdfReservation } from "./payout-pdf";
const reservation: PayoutPdfReservation = { payout_flow: "stayo", reservation_code: "RSV-00461", channel: "direta", guest_name: "Hóspede de teste", guest_cpf: "12345678909", checkin_date: "2026-10-30", checkout_date: "2026-11-02", gross_cents: 250000, cleaning_cents: 30000, platform_fee_cents: 0, owner_direct_cents: 0 };
const input: PayoutPdfInput = { property: "Imóvel de teste", propertyCode: "TEST", competence: "2026-10", adminFeePercent: 20, reservations: [reservation], expenses: [], transfers: [], palette: { navy: [0,0,0.2], cobalt: [0,0,0.6], coral: [0.7,0,0], gold: [0.5,0.4,0], paper: [1,1,1], ink: [0,0,0], muted: [0.4,0.4,0.4], border: [0.8,0.8,0.8], soft: [0.95,0.95,0.95], onSolid: [1,1,1] } };
describe("PDF mensal de repasse", () => {
  it("preserva os 11 dígitos do CPF, sem máscara", () => { expect(payoutPdfCpf("12345678909")).toBe("123.456.789-09"); });
  it("ausência de CPF não inventa um documento", () => { expect(payoutPdfCpf(null)).toBe("Não informado"); });
  it("valor ausente não é zero e bloqueia fechamento", async () => {
    const r = { ...reservation, gross_cents: 0, missing_amounts: ["gross"] };
    expect(payoutPdfAmount(r, "gross", 0)).toBe("Não informado");
    expect(payoutPdfReadiness({ ...input, reservations: [r] })).toBe(false);
    await expect(generatePayoutPdf({ ...input, reservations: [r] })).rejects.toThrow();
  });
  it("cortesia de valor zero permite documento", () => { expect(payoutPdfReadiness({ ...input, reservations: [{ ...reservation, reservation_code: "RSV-00201", gross_cents: 0, cleaning_cents: 0 }] })).toBe(true); });
  it("RSV-00461 mantém bruto 2500, limpeza 300 e saldo 1760", () => { expect(computeStatement(input.competence, 20, [reservation], [], []).balance).toBe(176000); });
  it("canal Airbnb no Ravena não torna o fluxo automático", () => { expect(computeStatement(input.competence, 20, [{ ...reservation, channel: "airbnb" }], [], []).balance).toBe(176000); });
  it("reservas automáticas têm saldo STAYO zero", () => { expect(computeStatement(input.competence, 20, [{ ...reservation, payout_flow: "platform_auto", owner_direct_cents: 176000 }], [], []).balance).toBe(0); });
});