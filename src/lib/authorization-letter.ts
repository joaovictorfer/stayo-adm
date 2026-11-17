import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { isValidCivilDate } from "./contract-document";
import { formatBrazilianDocument } from "./owner-form-validation";

/** Format only complete, explicitly labelled documents; never touch masked values or unrelated numbers. */
export function formatLetterDocuments(value: string): string {
  return value.replace(/\b(CPF|CNPJ)(\s*(?:n[º°.]\s*)?)([\d.\/-]+)/gi, (original, label: string, separator: string, document: string) => {
    const digits = document.replace(/\D/g, "");
    if (digits.length !== (label.toUpperCase() === "CPF" ? 11 : 14)) return original;
    return `${label}${separator}${formatBrazilianDocument(digits)}`;
  });
}

const cpfDigits = (v: string) => v.replace(/\D/g, "");
const line = z.string().trim().min(1).max(200);
export const authorizationLetterSchema = z.object({
  owners: z.array(z.object({ name: line, cpf: z.string().refine(v => cpfDigits(v).length === 11, "CPF inválido") })).min(1).max(4),
  gender: z.enum(["m", "f"]),
  unit: line.max(40), tower: line.max(60), condominium: line, address: line.max(300), city: line.max(80),
  date: z.string().refine(isValidCivilDate, "Data inexistente"),
  representatives: z.array(line).max(10),
  vehicles: z.array(z.string().trim().min(1).max(20)).max(10),
  contact: line,
});
export type AuthorizationLetterFields = z.infer<typeof authorizationLetterSchema>;

export const defaultLetterExtras = {
  representatives: ["STAYO – Gestão de Imóveis – CNPJ 67.217.149/0001-06", "João Victor Fernandes Dantas – CPF 094.860.164-70", "Luana Lima de Oliveira – CPF 114.011.974-50"],
  vehicles: ["RXZ-6C47", "IWA-1F83"],
  contact: "(54) 99140-3953 – STAYO Gestão de Imóveis",
};

type Run = { text: string; bold?: boolean };
type Para = { runs: Run[]; align?: "center" | "both" | "right" | "left"; after?: number; divider?: boolean };

/** Texto da carta em parágrafos, sem formatação Word (testável). */
export function letterParagraphs(f: AuthorizationLetterFields): Para[] {
  const plural = f.owners.length > 1;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${f.date}T12:00:00Z`));
  const heading = (text: string): Para => ({ runs: [{ text, bold: true }], align: "left", after: 180, divider: true });
  const list = (items: string[]): Para[] => items.map((t, i) => ({ runs: [{ text: t }], align: "left", after: i === items.length - 1 ? 160 : 40 }));
  const paras: Para[] = [
    { runs: [{ text: `CARTA DE AUTORIZAÇÃO À PORTARIA DO ${f.condominium.toUpperCase()}`, bold: true }], align: "center", after: 240 },
    heading(plural ? "PROPRIETÁRIOS" : "PROPRIETÁRIO(A)"),
    ...f.owners.map((o): Para => ({ runs: [{ text: o.name.toUpperCase(), bold: true }, { text: ` – CPF nº ${formatBrazilianDocument(o.cpf)}` }], align: "left", after: 80 })),
    { runs: [{ text: "CONTRATADO: ", bold: true }, { text: "STAYO – Gestão de Imóveis – CNPJ 67.217.149/0001-06" }], align: "left", after: 120 },
    { runs: [{ text: "IMÓVEL: ", bold: true }, { text: `Apartamento nº ${f.unit}, Torre ${f.tower}, ${f.condominium}, situado na ${f.address.replace(/\.$/, "")}.` }], after: 200 },
    { runs: [{ text: plural ? "AUTORIZAMOS" : "AUTORIZO", bold: true }, { text: ", por prazo indeterminado, a empresa STAYO – Gestão de Imóveis, inscrita no CNPJ 67.217.149/0001-06, a exercer a administração integral do referido imóvel, inclusive para fins de hospedagem por temporada." }], after: 180 },
    { runs: [{ text: `${plural ? "Autorizamos" : "Autorizo"}, ainda, de forma expressa, o ingresso, circulação e permanência no condomínio de representantes da administradora, seus sócios, colaboradores, prestadores de serviços, terceiros necessários à operação, bem como de hóspedes devidamente cadastrados.` }] },
  ];
  if (f.representatives.length) paras.push(heading("REPRESENTANTES AUTORIZADOS"), ...list(f.representatives.map(formatLetterDocuments)));
  if (f.vehicles.length) paras.push(heading("VEÍCULOS AUTORIZADOS"), { runs: [{ text: f.vehicles.map(v => v.toUpperCase()).join("     |     "), bold: true }], align: "left", after: 200 });
  paras.push(
    { runs: [{ text: "Fica estabelecido que todas as comunicações referentes ao imóvel deverão ser centralizadas junto à STAYO, por meio dos contatos:" }] },
    { runs: [{ text: f.contact, bold: true }], align: "left" },
    { runs: [{ text: `A presente autorização permanecerá válida até comunicação expressa de cancelamento à portaria/administração do ${f.condominium}.` }] },
    { runs: [{ text: `${f.city}, ${date}.` }], align: "right", after: 300 },
  );
  f.owners.forEach(o => paras.push(
    { runs: [{ text: "_______________________________________" }], align: "center", after: 0 },
    { runs: [{ text: o.name.toUpperCase(), bold: true }], align: "center", after: 0 },
    { runs: [{ text: `CPF ${formatBrazilianDocument(o.cpf)}` }], align: "center", after: 200 },
  ));
  return paras.map(p => ({ ...p, after: p.after ?? 160 }));
}

const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const font = '<w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/>';
const paraXml = (p: Para) => `<w:p><w:pPr>${p.divider ? '<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="A8A8A8"/></w:pBdr>' : ''}<w:spacing w:after="${p.after ?? 240}" w:line="276" w:lineRule="auto"/><w:jc w:val="${p.align ?? "both"}"/><w:rPr>${font}</w:rPr></w:pPr>${p.runs.map(r => `<w:r><w:rPr>${font}${r.bold ? "<w:b/><w:bCs/>" : ""}</w:rPr><w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`).join("")}</w:p>`;

/** Reaproveita o DOCX oficial do contrato (estilos, cabeçalho, rodapé, margens) e troca só o corpo. */
export function generateAuthorizationLetterDocx(original: Uint8Array, fields: AuthorizationLetterFields): Uint8Array {
  const files = unzipSync(original);
  const raw = files["word/document.xml"];
  if (!raw) throw new Error("Modelo Word inválido.");
  const xml = strFromU8(raw);
  const open = xml.indexOf("<w:body>");
  const sect = xml.lastIndexOf("<w:sectPr");
  if (open < 0 || sect < open) throw new Error("Modelo Word inválido.");
  const body = letterParagraphs(fields).map(paraXml).join("");
  files["word/document.xml"] = strToU8(xml.slice(0, open + "<w:body>".length) + body + xml.slice(sect));
  return zipSync(files);
}
