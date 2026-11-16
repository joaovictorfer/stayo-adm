import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { fillContractXml, generateContractDocx, reais, type ContractDocumentFields } from "./contract-document";
import { createHash } from "node:crypto";
import templateMap from "./contract-template-map.json";

const original = new Uint8Array(readFileSync("src/assets/contracts/contrato-stayo-original.docx"));
/** Exatamente os dados da nova referência Vêneto A201 enviada pela STAYO. */
export const sampleFields: ContractDocumentFields = {
  qualification: templateMap.paragraphs["2"].slice("CONTRATANTE(S): ".length),
  propertyDescription: templateMap.paragraphs["6"],
  pixKey: "51996262235", signatureNames: "BRUNA ANDIARA RASCHE HAUPENTHAL / JONATHAN HAUPENTHAL", signatureDate: "2026-11-12", signatureCity: "Canela/RS",
  administrationFee: 20, durationMonths: 12, maintenanceLimit: 300, noticePeriodDays: 30, ownerUseNoticeDays: 3, implementationFee: 500,
  exclusivity: true, payoutMode: "platform_auto", witness1Name: "Luana Lima de Oliveira", witness1Cpf: "114.011.974-50", witness2Name: "", witness2Cpf: "",
};
const paragraphs = (b?: Uint8Array) => [...strFromU8(b ?? new Uint8Array()).matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)].map(m => m[0]);
const text = (b?: Uint8Array) => [...strFromU8(b ?? new Uint8Array()).matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("");
const other: ContractDocumentFields = {
  ...sampleFields, qualification: "JOÃO TESTE & FILHOS, casado, Médico, inscrito(a) no CPF nº 111.444.777-35.", propertyDescription: "Apartamento nº 203, Torre C, localizado no Residencial Vêneto.",
  pixKey: "joao@example.com", signatureNames: "JOÃO TESTE", signatureDate: "2027-01-05", administrationFee: 25, durationMonths: 24, maintenanceLimit: 500,
  noticePeriodDays: 60, ownerUseNoticeDays: 2, implementationFee: 1500, exclusivity: false, payoutMode: "day10_report",
  witness2Name: "Ana Exemplo", witness2Cpf: "390.533.447-05",
};

describe("contrato padrão (referência Vêneto A201 de 16/11)", () => {
  it("mantém a identidade do arquivo oficial fixada no mapa da minuta", () => {
    expect(createHash("sha256").update(original).digest("hex")).toBe(templateMap.sha256);
  });
  it("preserva propriedades de todas as páginas, tabelas e trechos com dados diferentes", () => {
    const source = unzipSync(original);
    const result = unzipSync(generateContractDocx(original, other));
    const withoutText = (xml: string) => xml.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, "<w:t></w:t>");
    expect(withoutText(strFromU8(result["word/document.xml"] ?? new Uint8Array())))
      .toBe(withoutText(strFromU8(source["word/document.xml"] ?? new Uint8Array())));
  });
  it("mantém o nome e a rua nos mesmos trechos formatados do modelo", () => {
    const filled = { ...other, qualification: "HELENA DUARTE PIRES, casada, Arquiteta.", propertyDescription: "Apartamento nº 203, Torre C, localizado no Residencial Vêneto, situado na Rua dos Testes, 456 – Bairro Centro – Gramado/RS – CEP 95670-000." };
    const before = paragraphs(unzipSync(original)["word/document.xml"]);
    const after = paragraphs(unzipSync(generateContractDocx(original, filled))["word/document.xml"]);
    const runs = (p: string) => [...p.matchAll(/<w:r(?=[\s>])[^>]*>[\s\S]*?<\/w:r>/g)].map(m => m[0]);
    const style = (run: string | undefined) => run?.match(/<w:rPr(?=[\s>])[^>]*>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    for (const [index, oldText, newText] of [[2, "BRUNA ANDIARA RASCHE HAUPENTHAL", "HELENA DUARTE PIRES"], [6, ">Rua<", "Rua dos Testes, 456"]] as const) {
      const oldRun = runs(before[index] ?? "").find(r => r.includes(oldText));
      const newRun = index === 6 ? runs(after[index] ?? "").find(r => r.includes("Rua dos Testes, 456")) : runs(after[index] ?? "").find(r => r.includes(newText));
      expect(oldRun).toBeDefined();
      expect(newRun).toBeDefined();
      expect(style(newRun)).toBe(style(oldRun));
    }
  });
  it("bloqueia uma minuta alterada em vez de preencher o campo errado", () => {
    const xml = strFromU8(unzipSync(original)["word/document.xml"] ?? new Uint8Array());
    expect(() => fillContractXml(xml.replace("BRUNA ANDIARA", "MINUTA ALTERADA"), other)).toThrow("A minuta mudou");
  });
  it("gera um arquivo idêntico ao modelo quando preenchido com os mesmos dados", () => {
    const result = unzipSync(generateContractDocx(original, sampleFields));
    const source = unzipSync(original);
    expect(Object.keys(result).sort()).toEqual(Object.keys(source).sort());
    for (const key of Object.keys(source)) expect(result[key]).toEqual(source[key]);
  });
  it("não altera nenhuma cláusula geral, cabeçalho, estilos ou imagens com outros dados", () => {
    const result = unzipSync(generateContractDocx(original, other));
    const source = unzipSync(original);
    for (const key of Object.keys(source).filter(k => k !== "word/document.xml")) expect(result[key]).toEqual(source[key]);
    const before = paragraphs(source["word/document.xml"]), after = paragraphs(result["word/document.xml"]);
    expect(after.length).toBe(before.length);
    expect(after.slice(43, 149)).toEqual(before.slice(43, 149));
    const variable = new Set(Object.keys(templateMap.paragraphs).map(Number));
    before.forEach((p, i) => { if (!variable.has(i)) expect(after[i]).toBe(p); });
  });
  it("preenche quadro-resumo, data e assinatura com os dados do cadastro", () => {
    const t = text(unzipSync(generateContractDocx(original, other))["word/document.xml"]);
    for (const s of ["CONTRATANTE(S): JOÃO TESTE &amp; FILHOS", "Apartamento nº 203, Torre C", "25% (vinte e cinco por cento)", "75% ao CONTRATANTE", "25% ao CONTRATADO",
      "até o dia 10 do mês subsequente ao check-out;", "Chave pix: joao@example.com", "48h antes do check-in", "R$ 500,00 sem necessidade", "NÃO — para fins",
      "24 (vinte e quatro) meses", "60 (sessenta) dias", "R$ 1.500,00 (mil e quinhentos reais) à título de implantação", "Canela/RS, 5 de janeiro de 2027.",
      "JOÃO TESTE", "Nome: Ana Exemplo", "CPF: 390.533.447-05"]) expect(t).toContain(s);
    for (const stale of ["BRUNA ANDIARA", "JONATHAN", "HAUPENTHAL", "016.912.240-90", "827.768.140-20", "51996262235", "Giuseppe Garibaldi", "Artur Reinheimer", "12 de novembro de 2026"]) expect(t).not.toContain(stale);
  });
  it("escreve o valor da implantação por extenso", () => {
    expect(reais(600)).toBe("seiscentos reais");
    expect(reais(1000)).toBe("mil reais");
    expect(reais(1500)).toBe("mil e quinhentos reais");
    expect(reais(2350)).toBe("dois mil trezentos e cinquenta reais");
  });
});

describe("Etapa 1 — regras do contrato", () => {
  it("remove controles XML ilegais sem perder texto e preserva as cláusulas", () => {
    const normal = generateContractDocx(original, other);
    const dirty = generateContractDocx(original, { ...other, pixKey: "joao\u0001@example.com" });
    expect(unzipSync(dirty)["word/document.xml"]).toEqual(unzipSync(normal)["word/document.xml"]);
  });
  it("escreve centavos por extenso", async () => {
    const { reais } = await import("./contract-document");
    expect(reais(600.5)).toBe("seiscentos reais e cinquenta centavos");
    expect(reais(1.01)).toBe("um real e um centavo");
    expect(reais(0.25)).toBe("vinte e cinco centavos");
    expect(reais(600.0)).toBe("seiscentos reais");
  });
  it("recusa datas inexistentes", async () => {
    const { isValidCivilDate } = await import("./contract-document");
    expect(isValidCivilDate("2026-02-31")).toBe(false);
    expect(isValidCivilDate("2026-04-31")).toBe(false);
    expect(isValidCivilDate("2028-02-29")).toBe(true);
  });
  it("recusa CPF inválido de testemunha", async () => {
    const { isValidCpf } = await import("./owner-form-validation");
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("114.011.974-50")).toBe(true);
  });
});
