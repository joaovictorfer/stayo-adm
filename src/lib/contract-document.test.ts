import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { fillContractXml, generateContractDocx, reais, type ContractDocumentFields } from "./contract-document";
import { createHash } from "node:crypto";
import templateMap from "./contract-template-map.json";
import { STANDARD_CLAUSES, implementationText } from "./contract-standard-clauses";

/** Minuta VENETO_A201-2 enviada pela STAYO em 17/11/2026 — referência oficial. */
const original = new Uint8Array(readFileSync("src/assets/contracts/contrato-stayo-veneto-a201.docx"));
export const sampleFields: ContractDocumentFields = {
  qualification: templateMap.paragraphs["2"].slice("CONTRATANTE(S): ".length),
  propertyDescription: templateMap.paragraphs["6"],
  pixKey: "51996262235", signatureNames: "", signatureDate: "2026-11-12", signatureCity: "Canela/RS",
  parties: [{ fullName: "BRUNA ANDIARA RASCHE HAUPENTHAL" }, { fullName: "JONATHAN HAUPENTHAL" }],
  administrationFee: 20, durationMonths: 12, maintenanceLimit: 300, noticePeriodDays: 30, ownerUseNoticeDays: 0, implementationFee: 500,
  exclusivity: true, payoutMode: "platform_auto", witness1Name: "Luana Lima de Oliveira", witness1Cpf: "114.011.974-50", witness2Name: "", witness2Cpf: "",
};
const paragraphs = (b?: Uint8Array) => [...strFromU8(b ?? new Uint8Array()).matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)].map(m => m[0]);
const plain = (p: string) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("");
const text = (b?: Uint8Array) => paragraphs(b).map(plain).join("");
const { parties: _sampleParties, ...sampleWithoutParties } = sampleFields;
const other: ContractDocumentFields = {
  ...sampleWithoutParties, qualification: "JOÃO TESTE & FILHOS, casado, Médico, inscrito(a) no CPF nº 111.444.777-35.", propertyDescription: "Apartamento nº 203, Torre C, localizado no Residencial Vêneto.",
  pixKey: "joao@example.com", signatureNames: "JOÃO TESTE", signatureDate: "2027-01-05", administrationFee: 25, durationMonths: 24, maintenanceLimit: 500,
  noticePeriodDays: 60, exclusivity: false, payoutMode: "day10_report", witness2Name: "Ana Exemplo", witness2Cpf: "390.533.447-05",
};

describe("contrato padrão (VENETO_A201-2 de 17/11)", () => {
  it("usa no servidor exatamente o Word anexado, fixado no mapa", async () => {
    expect(createHash("sha256").update(original).digest("hex")).toBe(templateMap.sha256);
    const { standardContractBase64 } = await import("./contract-standard-template.server");
    expect(new Uint8Array(Buffer.from(standardContractBase64, "base64"))).toEqual(original);
  });
  it("gera um arquivo idêntico ao anexo quando preenchido com os mesmos dados", () => {
    const result = unzipSync(generateContractDocx(original, sampleFields));
    const source = unzipSync(original);
    expect(Object.keys(result).sort()).toEqual(Object.keys(source).sort());
    for (const key of Object.keys(source).filter(k => k !== "word/document.xml")) expect(result[key]).toEqual(source[key]);
    expect(result["word/document.xml"]).toEqual(source["word/document.xml"]);
  });
  it("mantém cláusulas gerais, contratado, cabeçalho, estilos e imagens idênticos ao anexo com outros dados", () => {
    const result = unzipSync(generateContractDocx(original, other));
    const source = unzipSync(original);
    for (const key of Object.keys(source).filter(k => k !== "word/document.xml")) expect(result[key]).toEqual(source[key]);
    const before = paragraphs(source["word/document.xml"]), after = paragraphs(result["word/document.xml"]);
    expect(after.length).toBe(before.length);
    expect(after.slice(43, 149)).toEqual(before.slice(43, 149));
    expect(plain(after[1] ?? "")).toContain("STAYO GRAMADO, pessoa jurídica");
    const variable = new Set(Object.keys(templateMap.paragraphs).map(Number));
    before.forEach((p, i) => { if (!variable.has(i)) expect(after[i]).toBe(p); });
    const structure = (s: string) => s.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, "<w:t></w:t>");
    expect(structure(strFromU8(result["word/document.xml"]!))).toBe(structure(strFromU8(source["word/document.xml"]!)));
  });
  it("os textos padrão do sistema são literalmente os do anexo", () => {
    const P = templateMap.paragraphs;
    expect(P["16"]).toBe(STANDARD_CLAUSES.payoutAuto);
    expect(P["17"]).toBe(STANDARD_CLAUSES.payoutFallback);
    expect(P["20"]).toBe(STANDARD_CLAUSES.ownerUse);
    expect(P["22"]).toBe(STANDARD_CLAUSES.marketing);
    expect(P["27"]).toBe(STANDARD_CLAUSES.periodicShutdown);
    expect(P["29"]).toBe(STANDARD_CLAUSES.exclusivity);
    expect(P["42"]?.trim()).toBe(implementationText("R$ 500,00", "quinhentos reais"));
    const all = paragraphs(unzipSync(original)["word/document.xml"]).map(plain).join("\n").replace(/&apos;/g, "'");
    for (const line of STANDARD_CLAUSES.fines.split("\n")) expect(all).toContain(line.slice(3));
    expect(all).toContain(STANDARD_CLAUSES.sale);
  });
  it("aplica textos editados na ficha aos itens 5, 6, 7 e 9", () => {
    const t = text(unzipSync(generateContractDocx(original, { ...other, summaryTexts: { payout: "Repasse especial.", ownerUse: "Uso livre.", marketing: "Marketing liberado.", periodicShutdown: "Sem paralisação." } }))["word/document.xml"]);
    for (const s of ["Repasse especial.", "Uso livre.", "Marketing liberado.", "Sem paralisação."]) expect(t).toContain(s);
    expect(t).not.toContain(STANDARD_CLAUSES.marketing);
  });
  it("substitui separadamente as duas assinaturas", () => {
    const f = { ...other, parties: [{ fullName: "Helena Duarte Pires" }, { fullName: "Carlos Alberto Teste" }] };
    const p = paragraphs(unzipSync(generateContractDocx(original, f))["word/document.xml"]);
    expect(plain((p[156] ?? "") + (p[157] ?? ""))).toBe("HELENA DUARTE PIRES");
    expect(plain((p[158] ?? "") + (p[159] ?? ""))).toBe("CARLOS ALBERTO TESTE");
  });
  it("bloqueia uma minuta alterada em vez de preencher o campo errado", () => {
    const xml = strFromU8(unzipSync(original)["word/document.xml"] ?? new Uint8Array());
    expect(() => fillContractXml(xml.replace("BRUNA ANDIARA", "MINUTA ALTERADA"), other)).toThrow("A minuta mudou");
  });
  it("preenche quadro-resumo, data e assinatura com os dados do cadastro", () => {
    const t = text(unzipSync(generateContractDocx(original, other))["word/document.xml"]);
    for (const s of ["CONTRATANTE(S): JOÃO TESTE &amp; FILHOS", "Apartamento nº 203, Torre C", "25% (vinte e cinco por cento)", "75% ao CONTRATANTE", "25% ao CONTRATADO",
      "até o dia 10 do mês subsequente ao check-out", "Chave pix: joao@example.com", "R$ 500,00 (quinhentos reais) à título de implantação", "R$ 500,00 sem necessidade", "NÃO — para fins",
      "24 (vinte e quatro) meses", "60 (sessenta) dias", "Canela/RS, 5 de janeiro de 2027.", "JOÃO TESTE", "Nome: Ana Exemplo", "CPF: 390.533.447-05"]) expect(t).toContain(s);
    for (const stale of ["BRUNA", "JONATHAN", "016.912.240-90", "827.768.140-20", "Giuseppe Garibaldi", "12 de novembro de 2026", "51996262235"]) expect(t).not.toContain(stale);
  });
  it("remove controles XML ilegais sem perder texto", () => {
    const normal = generateContractDocx(original, other);
    const dirty = generateContractDocx(original, { ...other, pixKey: "joao\u0001@example.com" });
    expect(unzipSync(dirty)["word/document.xml"]).toEqual(unzipSync(normal)["word/document.xml"]);
  });
  it("usa a chave Pix e o valor de implantação informados, marcando Pix ausente", () => {
    const t = text(unzipSync(generateContractDocx(original, { ...other, pixKey: "", implementationFee: 750 }))["word/document.xml"]);
    expect(t).toContain("Chave pix: [A DEFINIR]");
    expect(t).toContain("R$ 750,00 (setecentos e cinquenta reais) à título de implantação");
  });
  it("escreve valores por extenso e recusa datas/CPFs inválidos", async () => {
    expect(reais(1500)).toBe("mil e quinhentos reais");
    expect(reais(600.5)).toBe("seiscentos reais e cinquenta centavos");
    const { isValidCivilDate } = await import("./contract-document");
    expect(isValidCivilDate("2026-02-31")).toBe(false);
    const { isValidCpf } = await import("./owner-form-validation");
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
});
