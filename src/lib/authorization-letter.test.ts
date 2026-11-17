import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { authorizationLetterSchema, defaultLetterExtras, formatLetterDocuments, generateAuthorizationLetterDocx, letterParagraphs } from "./authorization-letter";
import { formatBrazilianDocument } from "./owner-form-validation";

const base = { owners: [{ name: "Maria Souza", cpf: "016.912.240-90" }], gender: "f" as const, unit: "201", tower: "Verona", condominium: "Residencial Vêneto", address: "Rua Artur Reinheimer, 550 – Bairro Carniel – Gramado/RS", city: "Gramado/RS", date: "2026-10-11", ...defaultLetterExtras };
const text = (f = base) => letterParagraphs(f).map(p => p.runs.map(r => r.text).join("")).join("\n");

describe("carta de autorização à portaria", () => {
  it("formata CPF com zeros iniciais em campos e dados para os dois documentos", () => {
    expect(formatBrazilianDocument("01691224090")).toBe("016.912.240-90");
    const paragraphs = letterParagraphs({ ...base, owners: [{ name: "Maria Souza", cpf: "01691224090" }] });
    expect(paragraphs.flatMap(p => p.runs).filter(r => r.text.includes("CPF")).every(r => !r.text.includes("01691224090"))).toBe(true);
  });
  it("formata CNPJ completo e preserva documentos mascarados e placas", () => {
    expect(formatLetterDocuments("STAYO – CNPJ 67217149000106")).toBe("STAYO – CNPJ 67.217.149/0001-06");
    expect(formatLetterDocuments("CPF 09486016470")).toBe("CPF 094.860.164-70");
    expect(formatLetterDocuments("CPF 094.***.***-70 · RXZ-6C47")).toBe("CPF 094.***.***-70 · RXZ-6C47");
  });
  it("usa proprietário, CPF, imóvel e condomínio", () => {
    const t = text();
    expect(t).toContain("CARTA DE AUTORIZAÇÃO À PORTARIA DO RESIDENCIAL VÊNETO");
    expect(t).toContain("Eu, MARIA SOUZA, inscrita no CPF nº 016.912.240-90, proprietária do Apartamento nº 201, Torre Verona");
    expect(t).toContain("Gramado/RS, 11 de outubro de 2026.");
    expect(t).toContain("– RXZ-6C47");
    expect(t).toContain("– Luana Lima de Oliveira – CPF 114.011.974-50");
  });
  it("usa plural com dois proprietários", () => {
    const t = text({ ...base, owners: [...base.owners, { name: "João Souza", cpf: "094.860.164-70" }] });
    expect(t).toContain("Nós, MARIA SOUZA");
    expect(t).toContain(", e JOÃO SOUZA");
    expect(t).toContain("proprietários do Apartamento");
    expect(t).toContain("AUTORIZAMOS");
  });
  it("bloqueia sem CPF", () => {
    expect(authorizationLetterSchema.safeParse({ ...base, owners: [{ name: "Maria", cpf: "" }] }).success).toBe(false);
  });
  it("preserva cabeçalho e margens do contrato", () => {
    const out = unzipSync(generateAuthorizationLetterDocx(new Uint8Array(readFileSync("src/assets/contracts/contrato-stayo-original.docx")), base));
    const xml = strFromU8(out["word/document.xml"]!);
    expect(xml).toContain('w:headerReference w:type="default"');
    expect(xml).not.toContain("CONTRATO DE PRESTAÇÃO");
    expect(out["word/styles.xml"]).toBeDefined();
  });
});
