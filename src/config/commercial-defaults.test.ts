import { describe, expect, it } from "vitest";

import {
  DEFAULT_QUICK_COMMERCIAL_CONFIRMATION,
  resolveQuickCommercialConfirmationDefaults,
} from "./commercial-defaults";

describe("defaults da confirmação comercial", () => {
  it("abre uma nova implantação com o padrão STAYO centralizado", () => {
    expect(resolveQuickCommercialConfirmationDefaults([])).toEqual({
      administrationFee: 20,
      turnoverCleaningFee: 250,
      exclusivity: true,
      durationMonths: 12,
      noticePeriodDays: 30,
    });
    expect(DEFAULT_QUICK_COMMERCIAL_CONFIRMATION.durationMonths).toBe(12);
  });

  it("prefere commercial_term_defaults para taxa e limpeza quando configurados", () => {
    expect(
      resolveQuickCommercialConfirmationDefaults([
        {
          label: "Taxa de administração",
          chargeType: "percentage",
          value: 18,
        },
        {
          label: "Limpeza comercial por reserva",
          chargeType: "per_reservation",
          value: 280,
        },
      ]),
    ).toMatchObject({ administrationFee: 18, turnoverCleaningFee: 280 });
  });

  it("não confunde outro percentual com a taxa de administração", () => {
    expect(
      resolveQuickCommercialConfirmationDefaults([
        { label: "Comissão do canal", chargeType: "percentage", value: 15 },
      ]).administrationFee,
    ).toBe(20);
  });
});
