import { describe, expect, it } from "vitest";
import { buildQualification, contractFieldsSchema, contractPartySchema, initialContractParties, type ContractParty } from "./contract-preparation";
import type { OwnerOnboardingSubmission } from "@/types/owner-onboarding";
const sampleFields = { qualification: 'Qualificação', propertyDescription: 'Apartamento nº 106', pixKey: 'helena@example.com', signatureNames: 'HELENA DUARTE PIRES', signatureDate: '2026-11-12', signatureCity: 'Gramado/RS', administrationFee: 20, durationMonths: 12, maintenanceLimit: 300, noticePeriodDays: 30, exclusivity: true, payoutMode: 'platform_auto', ownerUseNoticeDays: 3, implementationFee: 600, witness1Name: 'Luana Lima de Oliveira', witness1Cpf: '114.011.974-50', witness2Name: '', witness2Cpf: '' };

const party: ContractParty = { personType: "pf", fullName: "Helena Duarte Pires", document: "529.982.247-25", email: "helena@example.com", phone: "54991001234", maritalStatus: "uniao_estavel", profession: "Arquiteta", address: "Rua de Teste, 10, Centro, Gramado/RS, CEP 95670-000", representative: "" };
describe("conferência estruturada do contrato", () => {
  it("formata CPF e CNPJ mesmo quando o cadastro contém apenas dígitos", () => {
    expect(buildQualification([{ ...party, document: '52998224725' }])).toContain('529.982.247-25');
    expect(buildQualification([{ ...party, personType: 'pj', document: '11222333000181' }])).toContain('11.222.333/0001-81');
  });
  it("qualifica duas pessoas com endereço confirmado igual apenas ao final", () => {
    const result = buildQualification([party, { ...party, fullName: "Carlos Teste", email: "carlos@example.com", phone: "54999887766" }]);
    expect(result).toContain(`ambos residentes e domiciliados no endereço ${party.address}.`);
    expect(result.split(party.address).length - 1).toBe(1);
    expect(result).toContain("e-mail carlos@example.com, telefone 54999887766");
  });
  it('permite gerar contrato sem segunda testemunha', () => {
    expect(contractFieldsSchema.safeParse({ ...sampleFields, parties: [party], witness2Name: '', witness2Cpf: '' }).success).toBe(true);
  });
  it('exige nome e CPF válido somente quando a segunda testemunha é preenchida', () => {
    const base = { ...sampleFields, parties: [party] };
    expect(contractFieldsSchema.safeParse({ ...base, witness2Name: 'Ana Exemplo', witness2Cpf: '' }).success).toBe(false);
    expect(contractFieldsSchema.safeParse({ ...base, witness2Name: '', witness2Cpf: '390.533.447-05' }).success).toBe(false);
    expect(contractFieldsSchema.safeParse({ ...base, witness2Name: 'Ana Exemplo', witness2Cpf: '111.111.111-11' }).success).toBe(false);
    expect(contractFieldsSchema.safeParse({ ...base, witness2Name: 'Ana Exemplo', witness2Cpf: '390.533.447-05' }).success).toBe(true);
  });
  it('mantém a primeira testemunha obrigatória', () => {
    expect(contractFieldsSchema.safeParse({ ...sampleFields, parties: [party], witness1Name: '', witness1Cpf: '' }).success).toBe(false);
  });
  it("recusa CPF inválido do proprietário", () => {
    expect(contractPartySchema.safeParse({ ...party, document: "111.111.111-11" }).success).toBe(false);
    expect(contractPartySchema.safeParse(party).success).toBe(true);
  });
  it.each(["maritalStatus", "profession", "address", "email", "phone"])("bloqueia proprietário sem %s", key => {
    expect(contractPartySchema.safeParse({ ...party, [key]: "" }).success).toBe(false);
  });
  it("recusa nome incompleto", () => expect(contractPartySchema.safeParse({ ...party, fullName: "Helena" }).success).toBe(false));
  it("mantém contatos próprios de cada pessoa e traduz o estado civil", () => {
    const result = buildQualification([party, { ...party, fullName: "Carlos Teste", email: "carlos@example.com", phone: "54999887766", address: "Rua do Carlos, 20" }]);
    expect(result).toContain("HELENA DUARTE PIRES, união estável");
    expect(result.split("; ")[1]).toContain("e-mail carlos@example.com, telefone 54999887766");
    expect(result.split("; ")[1]).not.toContain("helena@example.com");
    expect(result.split("; ")[1]).toContain("Rua do Carlos, 20");
  });
  it("não atribui endereço e contatos do titular a outro contratante", () => {
    const o = { ...party, street: "Rua Principal", number: "10", city: "Gramado", state: "RS", postalCode: "95670-000", people: [party, { ...party, email: "", phone: "" }] } as unknown as OwnerOnboardingSubmission;
    const prepared = initialContractParties(o);
    expect(prepared[0]?.address).toContain("Rua Principal");
    expect(prepared[1]).toMatchObject({ address: "", email: "", phone: "" });
  });
  it("recompõe qualificação e assinaturas no servidor para impedir divergência", () => {
    const parsed = contractFieldsSchema.parse({ parties: [party], qualification: "Texto divergente", signatureNames: "Outro nome", propertyDescription: "Apartamento nº 106", pixKey: "helena@example.com", signatureDate: "2026-11-11", signatureCity: "Gramado/RS", administrationFee: 20, durationMonths: 12, maintenanceLimit: 300, noticePeriodDays: 30, exclusivity: true, payoutMode: "platform_auto", ownerUseNoticeDays: 3, implementationFee: 600, witness1Name: "Luana Lima de Oliveira", witness1Cpf: "114.011.974-50", witness2Name: "Carlos Teste", witness2Cpf: "390.533.447-05" });
    expect(parsed.qualification).toBe(buildQualification([party]));
    expect(parsed.signatureNames).toBe("HELENA DUARTE PIRES");
  });
  it("exige representante e CNPJ válido na qualificação de empresa", () => {
    const company = { ...party, personType: "pj", fullName: "Empresa Teste Ltda", document: "11.222.333/0001-81", maritalStatus: "", profession: "" };
    expect(contractPartySchema.safeParse(company).success).toBe(false);
    expect(contractPartySchema.safeParse({ ...company, representative: "Helena Duarte Pires, CPF 529.982.247-25" }).success).toBe(true);
    expect(contractPartySchema.safeParse({ ...company, representative: "Helena", document: "11.111.111/1111-11" }).success).toBe(false);
  });
});