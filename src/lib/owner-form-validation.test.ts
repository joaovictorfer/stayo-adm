import { describe, expect, it } from "vitest";

import {
  isValidBrazilianDocument,
  isValidCnpj,
  isValidCpf,
  normalizeDocument,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  ownerAdminEditSchema,
  suggestPixKey,
} from "./owner-form-validation";

describe("documentos brasileiros", () => {
  it.each(["094.860.164-70", "09486016470", "529.982.247-25"])("aceita CPF válido %s", (value) => {
    expect(isValidCpf(value)).toBe(true);
    expect(isValidBrazilianDocument(value)).toBe(true);
  });

  it.each(["094.860.164-71", "123.456.789-00", "111.111.111-11", "123"])(
    "rejeita CPF inválido %s",
    (value) => {
      expect(isValidCpf(value)).toBe(false);
    },
  );

  it.each(["04.252.011/0001-10", "04252011000110", "11.222.333/0001-81"])(
    "aceita CNPJ válido %s",
    (value) => {
      expect(isValidCnpj(value)).toBe(true);
    },
  );

  it.each(["04.252.011/0001-11", "00.000.000/0000-00", "123"])(
    "rejeita CNPJ inválido %s",
    (value) => {
      expect(isValidCnpj(value)).toBe(false);
    },
  );
});

describe("sugestões inteligentes para repasse", () => {
  const person = {
    personType: "pf" as const,
    fullName: "João Victor",
    document: "094.860.164-70",
    email: " JOAO@EXEMPLO.COM ",
    phone: "(54) 99999-1234",
  };

  it("sugere dados cadastrais conforme o tipo de chave Pix", () => {
    expect(suggestPixKey(person, "cpf")).toBe("09486016470");
    expect(suggestPixKey(person, "phone")).toBe("5554999991234");
    expect(suggestPixKey(person, "email")).toBe("joao@exemplo.com");
    expect(suggestPixKey(person, "random")).toBe("");
  });
});

describe("normalização por tipo", () => {
  it("normaliza documento e telefone sem afetar texto", () => {
    expect(normalizeDocument("094.860.164-70")).toBe("09486016470");
    expect(normalizePhone("+55 (11) 99999-1234")).toBe("5511999991234");
    expect(normalizeEmail("  VICTOR@EXEMPLO.COM ")).toBe("victor@exemplo.com");
    expect(normalizeName("  Victor   Fernandes Dantas ")).toBe("victor fernandes dantas");
  });

  it("bloqueia documento inválido na edição administrativa", () => {
    expect(
      ownerAdminEditSchema.safeParse({
        name: "Victor Fernandes",
        phone: "(11) 99999-1234",
        email: "victor@exemplo.com",
        document: "094.860.164-70",
      }).success,
    ).toBe(true);
    expect(
      ownerAdminEditSchema.safeParse({
        name: "Victor Fernandes",
        phone: "(11) 99999-1234",
        email: "victor@exemplo.com",
        document: "111.111.111-11",
      }).success,
    ).toBe(false);
  });
});
