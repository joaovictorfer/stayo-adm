import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { fillContractXml, generateContractDocx, reais, type ContractDocumentFields } from "./contract-document";
import { createHash } from "node:crypto";
import templateMap from "./contract-template-map.json";
import { STANDARD_CLAUSES } from "./contract-standard-clauses";

/** CONTRATO_STAYO_02.docx enviado pela STAYO em 17/11/2026 — referência oficial. */
const original = new Uint8Array(readFileSync("src/assets/contracts/contrato-stayo-02.docx"));
export const sampleFields: ContractDocumentFields = {
  qualification: templateMap.paragraphs["2"].slice("CONTRATANTE(S): ".length),
  propertyDescription: templateMap.paragraphs["6"],
  pixKey: "", signatureNames: "", signatureDate: "2026-10-22", signatureCity: "Canela/RS",
  parties: [{ fullName: "GEÓRGIA KARLA DE ALMEIDA CIDRIM" }, { fullName: "DANIEL MARSOL MÚRCIA DE ALBUQUERQUE" }],
  administrationFee: 20, durationMonths: 12, maintenanceLimit: 300, noticePeriodDays: 30, ownerUseNoticeDays: 0, implementationFee: 0,
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

describe("contrato padrão (CONTRATO_STAYO_02 de 17/11)", () => {
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
    // O anexo assina na ordem inversa da qualificação; só as linhas de assinatura (150–153) podem diferir.
    const a = paragraphs(result["word/document.xml"]), b = paragraphs(source["word/document.xml"]);
    b.forEach((p, i) => { if (i < 150 || i > 153) expect(a[i]).toBe(p); });
  });
  it("mantém cláusulas gerais, contratado, cabeçalho, estilos e imagens idênticos ao anexo com outros dados", () => {
    const result = unzipSync(generateContractDocx(original, other));
    const source = unzipSync(original);
    for (const key of Object.keys(source).filter(k => k !== "word/document.xml")) expect(result[key]).toEqual(source[key]);
    const before = paragraphs(source["word/document.xml"]), after = paragraphs(result["word/document.xml"]);
    expect(after.length).toBe(before.length);
    expect(after.slice(39, 144)).toEqual(before.slice(39, 144));
    expect(plain(after[1] ?? "")).toContain("SERRA SERV E HOSP LTDA");
    const variable = new Set(Object.keys(templateMap.paragraphs).map(Number));
    before.forEach((p, i) => { if (!variable.has(i)) expect(after[i]).toBe(p); });
    const structure = (s: string) => s.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, "<w:t></w:t>");
    expect(structure(strFromU8(result["word/document.xml"]!))).toBe(structure(strFromU8(source["word/document.xml"]!)));
  });
  it("os textos padrão do sistema são literalmente os do anexo", () => {
    const P = templateMap.paragraphs;
    expect(P["16"]).toBe(STANDARD_CLAUSES.payout);
    expect(P["18"]).toBe(STANDARD_CLAUSES.ownerUse);
    expect(P["20"]).toBe(STANDARD_CLAUSES.marketing);
    expect(P["25"]).toBe(STANDARD_CLAUSES.periodicShutdown);
    expect(P["27"]).toBe(STANDARD_CLAUSES.exclusivity);
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
    expect(plain((p[150] ?? "") + (p[151] ?? ""))).toBe("HELENA DUARTE PIRES");
    expect(plain((p[152] ?? "") + (p[153] ?? ""))).toBe("CARLOS ALBERTO TESTE");
  });
  it("bloqueia uma minuta alterada em vez de preencher o campo errado", () => {
    const xml = strFromU8(unzipSync(original)["word/document.xml"] ?? new Uint8Array());
    expect(() => fillContractXml(xml.replace("GEÓRGIA KARLA", "MINUTA ALTERADA"), other)).toThrow("A minuta mudou");
  });
  it("preenche quadro-resumo, data e assinatura com os dados do cadastro", () => {
    const t = text(unzipSync(generateContractDocx(original, other))["word/document.xml"]);
    for (const s of ["CONTRATANTE(S): JOÃO TESTE &amp; FILHOS", "Apartamento nº 203, Torre C", "25% (vinte e cinco por cento)", "75% ao CONTRATANTE", "25% ao CONTRATADO",
      "até o dia 10 do mês subsequente ao check-out", "chave joao@example.com", "R$ 500,00 sem necessidade", "NÃO — para fins",
      "24 (vinte e quatro) meses", "60 (sessenta) dias", "Canela/RS, 5 de janeiro de 2027.", "JOÃO TESTE", "Nome: Ana Exemplo", "CPF: 390.533.447-05"]) expect(t).toContain(s);
    for (const stale of ["GEÓRGIA", "DANIEL MARSOL", "036.780.794-74", "030.242.684-13", "Boa Viagem", "22 de outubro de 2026"]) expect(t).not.toContain(stale);
  });
  it("remove controles XML ilegais sem perder texto", () => {
    const normal = generateContractDocx(original, other);
    const dirty = generateContractDocx(original, { ...other, pixKey: "joao\u0001@example.com" });
    expect(unzipSync(dirty)["word/document.xml"]).toEqual(unzipSync(normal)["word/document.xml"]);
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
