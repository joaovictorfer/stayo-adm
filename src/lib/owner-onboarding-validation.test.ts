import { describe, expect, it } from "vitest";

import type { OwnerOnboardingDraft, PixKeyType } from "../types/owner-onboarding";
import { formatPostalCode, formatTaxId, isStepValid } from "./owner-onboarding-validation";

const complete = (personType: "pf" | "pj" = "pf"): OwnerOnboardingDraft => ({
  personType, legalName: personType === "pf" ? "Victor Silva" : "Victor Hospedagens Ltda", tradeName: personType === "pj" ? "Victor Stay" : "", taxId: personType === "pf" ? "12345678901" : "12345678000199", email: "victor@example.com", phone: "54999999999", postalCode: "95670000", street: "Rua das Hortênsias", number: "304", complement: "", district: "Centro", city: "Gramado", state: "RS", currentStep: 5, submittedAt: null, bankName: "Banco Inter", accountHolder: "Victor Silva", holderTaxId: "12345678901", pixType: "cpf", pixKey: "12345678901", isPrimary: true, confirmed: true,
});

describe("cadastro do proprietário", () => {
  it("valida identificação PF e PJ", () => {
    expect(isStepValid(1, complete("pf"))).toBe(true);
    expect(isStepValid(1, complete("pj"))).toBe(true);
    expect(formatTaxId("12345678901", "pf")).toBe("123.456.789-01");
    expect(formatTaxId("12345678000199", "pj")).toBe("12.345.678/0001-99");
  });

  it("formata CEP e permite endereço manual completo", () => {
    expect(formatPostalCode("95670000")).toBe("95670-000");
    expect(isStepValid(3, complete())).toBe(true);
  });

  it.each<PixKeyType>(["cpf", "cnpj", "phone", "email", "random"])("aceita o tipo PIX %s", (pixType) => {
    expect(isStepValid(4, { ...complete(), pixType, pixKey: "chave-valida" })).toBe(true);
  });

  it("mantém a etapa salva para retomada", () => {
    const resumed = { ...complete(), currentStep: 4, confirmed: false };
    expect(resumed.currentStep).toBe(4);
    expect(resumed.email).toBe("victor@example.com");
  });
});