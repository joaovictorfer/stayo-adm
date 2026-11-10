import { describe, expect, it } from "vitest";
import { computeStatement } from "../payout-statement";
import { payoutPdfCpf, payoutPdfAmount, payoutPdfReadiness, payoutPdfSplit, payoutPdfBalance, generatePayoutPdf, type PayoutPdfInput, type PayoutPdfReservation } from "./payout-pdf";
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
  it("canal Airbnb no Ravena não torna o fluxo automático", () => { const airbnb: PayoutPdfReservation = { ...reservation, channel: "airbnb" }; expect(computeStatement(input.competence, 20, [airbnb], [], []).balance).toBe(176000); });
  it("reservas automáticas têm saldo STAYO zero", () => { expect(computeStatement(input.competence, 20, [{ ...reservation, payout_flow: "platform_auto", owner_direct_cents: 176000 }], [], []).balance).toBe(0); });
  it("divisão padrão 20/80 sobre as diárias líquidas", () => { expect(payoutPdfSplit(reservation, 20)).toEqual({ base: 220000, stayo: 44000, owner: 176000 }); });
  it("reserva direta RSV-00461 apresenta total 2200, STAYO 440 e proprietário 1760 sem alterar o saldo", () => {
    const split = payoutPdfSplit(reservation, 20);
    expect(split.base).toBe(220000);
    expect(split.stayo).toBe(44000);
    expect(split.owner).toBe(176000);
    expect(split.owner).toBe(computeStatement(input.competence, 20, [reservation], [], []).ownerShare);
  });
  it("exceção contratual 15/85 (Delle Alpi 506B)", () => { expect(payoutPdfSplit(reservation, 15)).toEqual({ base: 220000, stayo: 33000, owner: 187000 }); });
  it("arredondamento da parte STAYO nunca reduz a do proprietário além do centavo", () => { const s = payoutPdfSplit({ ...reservation, gross_cents: 9999, cleaning_cents: 0 }, 20); expect(s.stayo).toBe(2000); expect(s.owner).toBe(7999); });
  it("balancete soma os totais das reservas e separa recebimento Airbnb do saldo STAYO", () => {
    const auto: PayoutPdfReservation = { ...reservation, payout_flow: "platform_auto", channel: "airbnb", gross_cents: 461526, owner_direct_cents: 281975 };
    const result = payoutPdfBalance({ ...input, reservations: [reservation, auto], transfers: [{ competence: "2026-10", amount_cents: 20000, paid_on: "2026-10-10", method: "pix" }], expenses: [{ occurred_on: "2026-10-10", amount_cents: 10000, charged_to_owner: true, description: "Manutenção", category: "manutencao" }] });
    expect(result.reservationCount).toBe(2);
    expect(result.totalReservations).toBe(651526);
    expect(result.airbnbReceived).toBe(281975);
    expect(result.totalReceived).toBe(301975);
    expect(result.statement.transferred).toBe(20000);
    expect(result.statement.balance).toBe(146000);
  });
  it("Airbnb recebido pela STAYO não é pagamento direto ao proprietário", () => {
    const result = payoutPdfBalance({ ...input, reservations: [{ ...reservation, channel: "airbnb", owner_direct_cents: 176000 }] });
    expect(result.airbnbReceived).toBe(0);
    expect(result.statement.balance).toBe(176000);
  });
  it("Airbnb usa a mesma divisão 20/80 e mantém o recebimento comprovado separado", () => {
    const auto: PayoutPdfReservation = { ...reservation, payout_flow: "platform_auto", channel: "airbnb", gross_cents: 461526, cleaning_cents: 30000, platform_fee_cents: 54000, owner_direct_cents: 281976 };
    expect(payoutPdfSplit(auto, 20)).toEqual({ base: 377526, stayo: 75505, owner: 302021 });
    const result = payoutPdfBalance({ ...input, reservations: [reservation, auto] });
    expect(result.totalReservations).toBe(597526);
    expect(result.airbnbReceived).toBe(281976);
    expect(result.totalReceived).toBe(281976);
    expect(result.statement.balance).toBe(176000);
  });
  it("recebimento direto ausente não vira zero nem divisão estimada", () => {
    const result = payoutPdfBalance({ ...input, reservations: [{ ...reservation, channel: "airbnb", payout_flow: "platform_auto", missing_amounts: ["owner_direct"] }] });
    expect(result.airbnbReceived).toBeNull();
    expect(result.totalReceived).toBeNull();
    expect(result.statement.balance).toBe(0);
  });
  it("balancete ignora reservas e repasses de outra competência", () => {
    const result = payoutPdfBalance({ ...input, reservations: [reservation, { ...reservation, checkin_date: "2026-11-01" }], transfers: [{ competence: "2026-11", amount_cents: 176000, paid_on: "2026-11-10", method: "pix" }] });
    expect(result.reservationCount).toBe(1);
    expect(result.totalReservations).toBe(220000);
    expect(result.statement.balance).toBe(176000);
  });
});