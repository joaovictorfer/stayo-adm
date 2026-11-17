import { STANDARD_CLAUSES } from "./contract-standard-clauses";
import { describe, expect, it } from "vitest";
import { buildContractCopy, type ContractCopyInput } from "./contract-copy";

const input: ContractCopyInput = {
  people: [{ name: "Pessoa Exemplo", document: "12345678901", maritalStatus: "uniao_estavel", profession: "Aposentada" }],
  ownerAddress: { street: "Rua Exemplo", number: "91", city: "Montenegro", state: "RS" },
  property: { unit: "506", tower: "B", condominium: "Delle Alpi", street: "Rua do Imóvel", city: "Canela", state: "RS" },
  conditions: { administrationFee: 15, maintenanceLimit: 300, payoutRule: "Até o dia 10 do mês seguinte." }, pixKey: "12345678901",
};

describe("contract clipboard data", () => {
  it("qualifies two proponents separately with their shared address only at the end", () => {
    const copy = buildContractCopy({ ...input, people: [
      { name: "Primeiro Proponente", document: "12345678901", profession: "Aposentado" },
      { name: "Segundo Proponente", document: "98765432100", profession: "Empresária" },
    ] }, true);
    expect(copy.contractorsText.split("Rua Exemplo").length - 1).toBe(1);
    expect(copy.contractorsText).toContain("PRIMEIRO PROPONENTE");
    expect(copy.contractorsText).toContain("SEGUNDO PROPONENTE");
    expect(copy.contractorsText).toMatch(/SEGUNDO PROPONENTE[\s\S]*ambos residentes e domiciliados no endereço Rua Exemplo, 91, Montenegro\/RS\.$/);
    expect(copy.qualifications[0]).not.toContain("Rua Exemplo");
    expect(copy.qualifications[1]).not.toContain("Rua Exemplo");
    expect(copy.contractorsHtml.split("Rua Exemplo").length - 1).toBe(1);
  });
  it("retains individual residence wording for a single proponent", () => {
    const copy = buildContractCopy(input, true);
    expect(copy.contractorsText).toContain("residente e domiciliado(a) em Rua Exemplo, 91, Montenegro/RS");
    expect(copy.contractorsText).not.toContain("ambos");
  });
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
    expect(copy.summaryText).toContain("c) Chave pix: 12345678901");
  });
  it("fills empty items 5–15 with the VENETO_A201-2 standard and keeps 15 items", () => {
    const copy = buildContractCopy({ ...input, conditions: { ...input.conditions, payoutRule: null, marketingRule: null, periodicShutdownRule: null } }, true);
    expect(copy.rows).toHaveLength(15);
    expect(copy.rows.map(r => r.title)).toEqual(["1 – IMÓVEL OBJETO:", "2 – DA TAXA ADMINISTRATIVA:", "3 – DA TAXA DE LIMPEZA:", "4 – DA DIVISÃO DOS VALORES:", "5 – DOS REPASSES:", "6 – DO USO PELO CONTRATANTE:", "7 – DO USO PARA MARKETING:", "8 – DA MANUTENÇÃO EMERGENCIAL:", "9 – DA PARALISAÇÃO PERIÓDICA:", "10 – DA EXCLUSIVIDADE:", "11 – DAS MULTAS:", "12 – VIGÊNCIA:", "13 – DA RESCISÃO:", "14 – DA VENDA DO IMÓVEL:", "15 – DA IMPLANTAÇÃO:"]);
    expect(copy.rows[4]?.body).toContain(STANDARD_CLAUSES.payout);
    expect(copy.rows[6]?.body).toBe(STANDARD_CLAUSES.marketing);
    expect(copy.rows[8]?.body).toBe(STANDARD_CLAUSES.periodicShutdown);
    expect(copy.rows.slice(4).some(r => r.body.includes("[A DEFINIR]"))).toBe(false);
    expect(copy.contractorsText).not.toContain("brasileir");
  });
  it("prefers the text edited in the ficha over the standard", () => {
    const copy = buildContractCopy({ ...input, conditions: { ...input.conditions, marketingRule: "Liberado para fotos." } });
    expect(copy.rows[6]?.body).toBe("Liberado para fotos.");
  });
  it("does not fabricate a rate when saved conditions have no percentage", () => {
    const copy = buildContractCopy({ ...input, conditions: {} });
    expect(copy.rows[1]?.body).toBe("[A DEFINIR]");
    expect(copy.rows[3]?.body).toBe("[A DEFINIR]");
  });
});