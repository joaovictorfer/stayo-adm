import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { letterIcons, letterPalette, type LetterIcon } from "./authorization-letter-icons";
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

export type Run = { text: string; bold?: boolean };
export type Para = { runs: Run[]; align?: "center" | "both" | "right" | "left"; after?: number; divider?: boolean; icon?: LetterIcon };
/** Blank handwriting area above each signature line, shared by Word and PDF (points). */
export const letterSignatureSpace = 48;

/** Texto da carta em parágrafos, sem formatação Word (testável). */
export function letterParagraphs(f: AuthorizationLetterFields): Para[] {
  const plural = f.owners.length > 1;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${f.date}T12:00:00Z`));
  const heading = (text: string, icon: LetterIcon): Para => ({ runs: [{ text, bold: true }], align: "left", after: 180, divider: true, icon });
  const list = (items: string[]): Para[] => items.map((t, i) => ({ runs: [{ text: t }], align: "left", after: i === items.length - 1 ? 160 : 40 }));
  const paras: Para[] = [
    { runs: [{ text: `CARTA DE AUTORIZAÇÃO À PORTARIA DO ${f.condominium.toUpperCase()}`, bold: true }], align: "center", after: 240 },
    heading(plural ? "PROPRIETÁRIOS" : "PROPRIETÁRIO(A)", "owner"),
    ...f.owners.map((o): Para => ({ runs: [{ text: o.name.toUpperCase(), bold: true }, { text: ` – CPF nº ${formatBrazilianDocument(o.cpf)}` }], align: "left", after: 80 })),
    heading("CONTRATADO", "company"),
    { runs: [{ text: "STAYO – Gestão de Imóveis", bold: true }, { text: " – CNPJ 67.217.149/0001-06" }], align: "left", after: 120 },
    heading("IMÓVEL", "property"),
    { runs: [{ text: `Apartamento nº ${f.unit}, Torre ${f.tower}, ${f.condominium}, situado na ${f.address.replace(/\.$/, "")}.` }], after: 200 },
    heading(plural ? "AUTORIZAMOS" : "AUTORIZO", "authorization"),
    { runs: [{ text: "Por prazo indeterminado, a empresa STAYO – Gestão de Imóveis, inscrita no CNPJ 67.217.149/0001-06, a exercer a administração integral do referido imóvel, inclusive para fins de hospedagem por temporada." }], after: 180 },
    { runs: [{ text: `${plural ? "Autorizamos" : "Autorizo"}, ainda, de forma expressa, o ingresso, circulação e permanência no condomínio de representantes da administradora, seus sócios, colaboradores, prestadores de serviços, terceiros necessários à operação, bem como de hóspedes devidamente cadastrados.` }] },
  ];
  if (f.representatives.length) paras.push(heading("REPRESENTANTES AUTORIZADOS", "representatives"), ...list(f.representatives.map(formatLetterDocuments)));
  if (f.vehicles.length) paras.push(heading("VEÍCULOS AUTORIZADOS", "vehicles"), { runs: [{ text: f.vehicles.map(v => v.toUpperCase()).join("     |     "), bold: true }], align: "left", after: 200 });
  paras.push(
    { runs: [{ text: "Fica estabelecido que todas as comunicações referentes ao imóvel deverão ser centralizadas junto à STAYO, por meio dos contatos:" }] },
    heading("CONTATO", "contact"),
    { runs: [{ text: formatLetterDocuments(f.contact), bold: true }], align: "left" },
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

export type LetterBlock = { kind: "paragraph"; paragraph: Para } | { kind: "parties"; columns: Para[][] } | { kind: "signatures"; columns: Para[][] } | { kind: "table"; rows: string[][] } | { kind: "vehicles"; plates: string[] };
/** One layout model shared by both exporters; free-form representative lines remain intact. */
export function letterLayout(fields: AuthorizationLetterFields): LetterBlock[] {
  const paragraphs = letterParagraphs(fields);
  const result: LetterBlock[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (!p) continue;
    if (p.icon === "owner") {
      const companyIndex = paragraphs.findIndex(item => item.icon === "company");
      result.push({ kind: "parties", columns: [paragraphs.slice(i, companyIndex), paragraphs.slice(companyIndex, companyIndex + 2)] });
      i = companyIndex + 1;
    } else if (p.icon === "representatives") {
      result.push({ kind: "paragraph", paragraph: p });
      result.push({ kind: "table", rows: [["NOME", "DOCUMENTO"], ...fields.representatives.map(value => {
        const formatted = formatLetterDocuments(value);
        const match = /\s*[–—-]?\s*((?:CPF|CNPJ)\b.*)$/i.exec(formatted);
        return match ? [formatted.slice(0, match.index).replace(/\s*[–—-]\s*$/, ""), match[1] ?? ""] : [formatted, ""];
      })] });
      i += fields.representatives.length;
    } else if (p.icon === "vehicles") {
      result.push({ kind: "paragraph", paragraph: p }, { kind: "vehicles", plates: fields.vehicles.map(v => v.toUpperCase()) });
      i++;
    } else if (p.runs[0]?.text.startsWith('___')) {
      const columns = fields.owners.map((_, ownerIndex) => paragraphs.slice(i + ownerIndex * 3, i + ownerIndex * 3 + 3));
      for (let start = 0; start < columns.length; start += 2) result.push({ kind: "signatures", columns: columns.slice(start, start + 2) });
      break;
    } else result.push({ kind: "paragraph", paragraph: p });
  }
  return result;
}

function iconXml(icon: LetterIcon): string {
  const id = Object.keys(letterIcons).indexOf(icon) + 700;
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="63500"><wp:extent cx="190500" cy="190500"/><wp:docPr id="${id}" name="${icon}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${icon}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLetter_${icon}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="190500" cy="190500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
function styledPara(p: Para): string {
  const xml = paraXml({ ...p, after: p.icon ? 100 : Math.min(p.after ?? 100, 120) });
  return xml.replace(/w:val="22"/g, 'w:val="19"').replace('w:line="276"', 'w:line="240"').replace('<w:jc w:val="both"/>', '<w:jc w:val="left"/>').replace('</w:pPr>', `</w:pPr>${p.icon ? iconXml(p.icon) + '<w:r><w:t xml:space="preserve">  </w:t></w:r>' : ''}`).replace(/<w:sz w:val="19"\/>/g, `<w:color w:val="${p.icon ? letterPalette.ink : letterPalette.text}"/><w:sz w:val="19"/>`);
}
function tableXml(columns: Para[][][], widths: number[], panel = false): string {
  const border = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(side => `<w:${side} w:val="single" w:sz="4" w:color="${panel ? letterPalette.panel : letterPalette.rule}"/>`).join("")}</w:tblBorders>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="8504" w:type="dxa"/><w:tblLayout w:type="fixed"/>${border}<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${columns.map((row, index) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((cell, col) => `<w:tc><w:tcPr><w:tcW w:w="${widths[col]}" w:type="dxa"/>${panel || index === 0 ? `<w:shd w:val="clear" w:fill="${letterPalette.panel}"/>` : ''}<w:vAlign w:val="${panel ? 'top' : 'center'}"/></w:tcPr>${cell.map(styledPara).join("")}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl><w:p><w:pPr><w:spacing w:after="80" w:line="40" w:lineRule="exact"/></w:pPr></w:p>`;
}

/** Reaproveita o DOCX oficial do contrato (estilos, cabeçalho, rodapé, margens) e troca só o corpo. */
export function generateAuthorizationLetterDocx(original: Uint8Array, fields: AuthorizationLetterFields): Uint8Array {
  const files = unzipSync(original);
  const raw = files["word/document.xml"];
  if (!raw) throw new Error("Modelo Word inválido.");
  const xml = strFromU8(raw);
  const open = xml.indexOf("<w:body>");
  const sect = xml.lastIndexOf("<w:sectPr");
  if (open < 0 || sect < open) throw new Error("Modelo Word inválido.");
  const body = letterLayout(fields).map(block => {
    if (block.kind === "paragraph") return styledPara(block.paragraph);
    if (block.kind === "parties") return tableXml([block.columns.map(col => col.map(p => ({ ...p, divider: false })))], [4252, 4252], true);
    if (block.kind === "signatures") {
      const cellWidth = Math.floor(8504 / block.columns.length);
      return `<w:tbl><w:tblPr><w:tblW w:w="8504" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side => `<w:${side} w:val="nil"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="${letterSignatureSpace * 20}" w:type="dxa"/><w:left w:w="180" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${block.columns.map(() => `<w:gridCol w:w="${cellWidth}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${block.columns.map(col => `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${col.map((p, index) => styledPara(index === 0 ? { ...p, runs: [{ text: block.columns.length > 1 ? '________________________' : '_______________________________________' }] } : p)).join('')}</w:tc>`).join('')}</w:tr></w:tbl><w:p/>`;
    }
    if (block.kind === "table") return tableXml(block.rows.map((row, i) => row.map(text => [{ runs: [{ text, bold: i === 0 }], align: "left", after: 0 }])), [4752, 3752]);
    return `<w:p><w:pPr><w:spacing w:after="180" w:line="300" w:lineRule="auto"/></w:pPr>${block.plates.map(plate => `<w:r><w:rPr>${font}<w:b/><w:sz w:val="19"/><w:shd w:val="clear" w:fill="${letterPalette.panel}"/></w:rPr><w:t xml:space="preserve">  ${esc(plate)}  </w:t></w:r><w:r><w:t xml:space="preserve">   </w:t></w:r>`).join('')}</w:p>`;
  }).join("");
  let document = xml.slice(0, open + "<w:body>".length) + body + xml.slice(sect);
  for (const [prefix, uri] of Object.entries({ wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", a: "http://schemas.openxmlformats.org/drawingml/2006/main", pic: "http://schemas.openxmlformats.org/drawingml/2006/picture" })) {
    if (!document.includes(`xmlns:${prefix}=`)) document = document.replace('<w:document ', `<w:document xmlns:${prefix}="${uri}" `);
  }
  files["word/document.xml"] = strToU8(document);
  const relPath = "word/_rels/document.xml.rels";
  let rels = strFromU8(files[relPath] ?? strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'));
  for (const [name, base64] of Object.entries(letterIcons)) {
    files[`word/media/letter-${name}.png`] = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    rels = rels.replace('</Relationships>', `<Relationship Id="rIdLetter_${name}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/letter-${name}.png"/></Relationships>`);
  }
  files[relPath] = strToU8(rels);
  const types = files["[Content_Types].xml"];
  if (types && !strFromU8(types).includes('Extension="png"')) files["[Content_Types].xml"] = strToU8(strFromU8(types).replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>'));
  return zipSync(files);
}
