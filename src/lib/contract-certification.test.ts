import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { contractFieldsSchema, type ContractParty } from "./contract-preparation";
import { generateContractDocx } from "./contract-document";

const original = new Uint8Array(readFileSync("src/assets/contracts/contrato-stayo-original.docx"));
const source = unzipSync(original);
const party: ContractParty = {
  personType: "pf", fullName: "Helena Duarte Pires", document: "529.982.247-25",
  email: "helena@example.com", phone: "54991001234", maritalStatus: "casado", profession: "Arquiteta",
  address: "Rua de Teste, 10, Centro, Gramado/RS", representative: "",
};
const fields = {
  parties: [party], qualification: "Recomposta pelo validador", signatureNames: "Recomposto pelo validador",
  propertyDescription: "Apartamento nº 106, Torre A, localizado no Residencial Ravena, situado na Rua de Teste, 10 – Centro – Gramado/RS.",
  pixKey: "helena@example.com", signatureDate: "2026-11-11", signatureCity: "Gramado/RS",
  administrationFee: 20, durationMonths: 12, maintenanceLimit: 300, noticePeriodDays: 30,
  exclusivity: true, payoutMode: "platform_auto" as const, ownerUseNoticeDays: 3, implementationFee: 600.5,
  witness1Name: "Luana Lima de Oliveira", witness1Cpf: "114.011.974-50",
  witness2Name: "Carlos Teste", witness2Cpf: "390.533.447-05",
};
const paragraphs = (xml: string) => [...xml.matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)].map(m => m[0]);
const sourceXml = strFromU8(source["word/document.xml"] ?? new Uint8Array());

describe("certificação da minuta com cadastros variados", () => {
  const scenarios = [
    { name: "titular", parties: [party] },
    { name: "dois contratantes com contatos próprios", parties: [party, { ...party, fullName: "Carlos Teste", document: "390.533.447-05", address: "Rua do Carlos, 20", email: "carlos@example.com", phone: "54999887766" }] },
    { name: "empresa com representante", parties: [{ ...party, personType: "pj" as const, fullName: "Empresa Teste Ltda", document: "11.222.333/0001-81", maritalStatus: "", profession: "", representative: "Helena Duarte Pires, CPF 529.982.247-25" }] },
    { name: "acentos e caracteres especiais", parties: [{ ...party, fullName: 'João D\'Ávila & Filhos', profession: 'Consultor <especial> "técnico"' }] },
    { name: "imóvel sem torre", propertyDescription: "Apartamento nº 203, localizado no Residencial Vêneto, situado na Rua de Teste, 20, Gramado/RS." },
    { name: "descrição longa", propertyDescription: "Apartamento nº 203, Torre C, localizado no Residencial Vêneto, situado na " + "Rua de Teste com complemento extenso, ".repeat(20) + "Gramado/RS." },
  ];
  it.each(scenarios)("preserva cláusulas e todas as partes fixas: $name", scenario => {
    const { name: _name, ...patch } = scenario;
    const result = unzipSync(generateContractDocx(original, contractFieldsSchema.parse({ ...fields, ...patch })));
    expect(Object.keys(result).sort()).toEqual(Object.keys(source).sort());
    for (const key of Object.keys(source).filter(k => k !== "word/document.xml")) expect(result[key]).toEqual(source[key]);
    const xml = strFromU8(result["word/document.xml"] ?? new Uint8Array());
    expect(paragraphs(xml).slice(43, 149)).toEqual(paragraphs(sourceXml).slice(43, 149));
    expect(xml).not.toContain("BRUNA ANDIARA");
    expect(xml).not.toContain("JONATHAN");
    expect(xml).not.toContain("016.912.240-90");
    const structure = (s: string) => s.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, "<w:t></w:t>");
    expect(structure(xml)).toBe(structure(sourceXml));
  });
  it.each([
    { signatureDate: "2026-02-31" }, { signatureDate: "2026-04-31" },
    { witness1Cpf: "123" }, { witness2Cpf: "111.111.111-11" },
    { parties: [{ ...party, document: "123" }] },
    { parties: [{ ...party, address: "" }] },
    { parties: [party, { ...party, fullName: "Carlos Teste", email: "" }] },
  ])("bloqueia dados inválidos antes de produzir o contrato: %j", patch => {
    expect(() => contractFieldsSchema.parse({ ...fields, ...patch })).toThrow();
  });
  it("mantém centavos coerentes no documento final", () => {
    const xml = strFromU8(unzipSync(generateContractDocx(original, contractFieldsSchema.parse(fields)))["word/document.xml"] ?? new Uint8Array());
    expect(xml).toContain("R$ 600,50 (seiscentos reais e cinquenta centavos)");
    expect(xml).not.toContain("seiscentos e um reais");
  });
});