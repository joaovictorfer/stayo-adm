import { describe, expect, it } from "vitest";
import { buildContractCopy, type ContractCopyInput } from "./contract-copy";

const input: ContractCopyInput = {
  people: [{ name: "Pessoa Exemplo", document: "12345678901", maritalStatus: "uniao_estavel", profession: "Aposentada" }],
  ownerAddress: { street: "Rua Exemplo", number: "91", city: "Montenegro", state: "RS" },
  property: { unit: "506", tower: "B", condominium: "Delle Alpi", street: "Rua do Imóvel", city: "Canela", state: "RS" },
  conditions: { administrationFee: 15, maintenanceLimit: 300, payoutRule: "Até o dia 10 do mês seguinte." }, pixKey: "12345678901",
};

describe("contract clipboard data", () => {
  it("uses the saved 15/85 division instead of substituting the standard 20/80", () => {
    const copy = buildContractCopy(input, true);
    expect(copy.rows[3]?.body).toContain("85%");
    expect(copy.rows[3]?.body).toContain("15%");
    expect(copy.rows[3]?.body).not.toContain("20%");
  });
  it("keeps full documents and Pix out of the default clipboard content", () => {
    const copy = buildContractCopy(input);
    expect(copy.text).not.toContain("12345678901");
    expect(copy.text).not.toContain("123.456.789-01");
  });
  it("includes full CPF and Pix only with explicit disclosure", () => {
    const copy = buildContractCopy(input, true);
    expect(copy.contractorsText).toContain("123.456.789-01");
    expect(copy.summaryText).toContain("Chave Pix: 12345678901");
  });
  it("does not infer marketing, periodic shutdown or nationality from the reference", () => {
    const copy = buildContractCopy(input, true);
    expect(copy.rows[6]?.body).toBe("[A DEFINIR]");
    expect(copy.rows[8]?.body).toBe("[A DEFINIR]");
    expect(copy.contractorsText).not.toContain("brasileir");
  });
  it("does not fabricate a rate when saved conditions have no percentage", () => {
    const copy = buildContractCopy({ ...input, conditions: {} });
    expect(copy.rows[1]?.body).toBe("[A DEFINIR]");
    expect(copy.rows[3]?.body).toBe("[A DEFINIR]");
  });
});