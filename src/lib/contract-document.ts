import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import templateMap from "./contract-template-map.json";

export interface ContractDocumentFields {
  qualification: string;
  propertyDescription: string;
  pixKey: string;
  signatureNames: string;
  signatureDate: string;
  signatureCity: string;
  administrationFee: number;
  durationMonths: number;
  maintenanceLimit: number;
  noticePeriodDays: number;
  exclusivity: boolean;
  payoutMode: "day10_report" | "platform_auto";
  ownerUseNoticeDays: number;
  implementationFee: number;
  witness1Name: string;
  witness1Cpf: string;
  witness2Name: string;
  witness2Cpf: string;
  parties?: Array<{ fullName: string }>;
  /** Textos editados na ficha para os itens 5 (a/b), 6, 7 e 9; vazio mantém o texto padrão do contrato. */
  summaryTexts?: { payout?: string | undefined; ownerUse?: string | undefined; marketing?: string | undefined; periodicShutdown?: string | undefined } | undefined;
}

const stripControl = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
const escape = (s: string) => stripControl(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const paragraphText = (p: string) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => unescape(m[1] ?? "")).join("");

/** Replace a text range without touching any run, paragraph or table properties. */
function substitute(p: string, old: string, value: string): string {
  const text = paragraphText(p);
  const start = text.indexOf(old);
  if (start < 0 || text.indexOf(old, start + old.length) >= 0) throw new Error("Trecho da minuta não corresponde ao modelo oficial.");
  return substituteRange(p, start, start + old.length, value);
}

/** Replace consecutive pieces of the paragraph so each piece keeps its own run style (bold, etc.). */
function substitutePieces(p: string, pieces: Array<[string, string]>): string {
  const text = paragraphText(p);
  const ranges: Array<[number, number, string]> = [];
  let from = 0;
  for (const [old, value] of pieces) {
    const start = text.indexOf(old, from);
    if (start < 0) throw new Error("Trecho da minuta não corresponde ao modelo oficial.");
    ranges.push([start, start + old.length, value]);
    from = start + old.length;
  }
  return ranges.reverse().reduce((cur, [s, e, v]) => (text.slice(s, e) === v ? cur : substituteRange(cur, s, e, v)), p);
}

function substituteRange(p: string, start: number, end: number, value: string): string {
  let offset = 0;
  let inserted = false;
  return p.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (node, open: string, content: string, close: string) => {
    const raw = unescape(content);
    const left = offset;
    const right = left + raw.length;
    offset = right;
    if (right <= start || left >= end) return node;
    const before = raw.slice(0, Math.max(0, start - left));
    const after = raw.slice(Math.max(0, end - left));
    const replacement = inserted ? "" : value;
    inserted = true;
    return `${open.includes("xml:space=") ? open : open.replace(/>$/, ' xml:space="preserve">')}${escape(before + replacement + after)}${close}`;
  });
}

const integers = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
function words(n: number): string {
  if (n < 20) return integers[n] ?? String(n);
  if (n === 100) return "cem";
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  return `${tens[Math.floor(n / 10)] ?? n}${n % 10 ? ` e ${integers[n % 10]}` : ""}`;
}
const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function upTo999(n: number): string {
  if (n < 100) return words(n);
  if (n === 100) return "cem";
  const r = n % 100;
  return `${hundreds[Math.floor(n / 100)]}${r ? ` e ${words(r)}` : ""}`;
}
function integerWords(n: number): string {
  const th = Math.floor(n / 1000), rest = n % 1000;
  const parts = [th ? (th === 1 ? "mil" : `${upTo999(th)} mil`) : "", rest ? upTo999(rest) : ""].filter(Boolean);
  return parts.length === 2 && (rest < 100 || rest % 100 === 0) ? parts.join(" e ") : parts.join(" ");
}
/** Valor por extenso em reais, com centavos exatos (até 999.999,99). */
export function reais(value: number): string {
  const total = Math.round(value * 100);
  const n = Math.floor(total / 100), c = total % 100;
  const cents = c ? `${words(c)} ${c === 1 ? "centavo" : "centavos"}` : "";
  if (n === 0) return cents || "zero reais";
  const whole = `${integerWords(n)}${n === 1 ? " real" : " reais"}`;
  return cents ? `${whole} e ${cents}` : whole;
}
/** Data civil existente no formato AAAA-MM-DD (recusa 31/02, 31/04 etc.). */
export function isValidCivilDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return y >= 1900 && date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}
const number = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
const percent = (n: number) => `${number(n)}% (${Number.isInteger(n) ? words(n) : number(n)} por cento)`;

export function fillContractXml(xml: string, f: ContractDocumentFields): string {
  const P = templateMap.paragraphs;
  const names = f.parties?.map(p => p.fullName.trim().toUpperCase()) ?? f.signatureNames.split(" / ");
  const signatureLines = (name: string): [string, string] => {
    const cut = name.lastIndexOf(" ");
    return cut < 0 ? [name, ""] : [name.slice(0, cut + 1), name.slice(cut + 1)];
  };
  const firstSignature = signatureLines(names[0] ?? "");
  const secondSignature = signatureLines(names.slice(1).join(" / "));
  const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n).replace(/\u00a0/g, " ");
  const T = f.summaryTexts ?? {};
  const whole = (i: number, value: string | undefined): Array<[string, string]> => [[(P as Record<string, string>)[String(i)] ?? "", value?.trim() || ((P as Record<string, string>)[String(i)] ?? "")]];
  const payoutLines = (T.payout?.trim() ?? "").split(/\n+/).map(l => l.replace(/^[a-c]\)\s*/, "").trim()).filter(Boolean);
  const updates = new Map<number, Array<[string, string]>>([
    [8, [["20% (vinte por cento)", percent(f.administrationFee)]]],
    [12, [["80%", `${number(100 - f.administrationFee)}%`]]],
    [13, [["20%", `${number(f.administrationFee)}%`]]],
    [16, whole(16, payoutLines[0])],
    [17, whole(17, payoutLines.length ? payoutLines.slice(1).join(" ") || " " : undefined)],
    [18, [[P["18"], `Chave pix: ${f.pixKey.trim() || "[A DEFINIR]"}`]]],
    [20, whole(20, T.ownerUse)],
    [22, whole(22, T.marketing)],
    [24, [["R$ 300,00", brl(f.maintenanceLimit)]]],
    [27, whole(27, T.periodicShutdown)],
    [29, [["SIM", f.exclusivity ? "SIM" : "NÃO"]]],
    [36, [["12 (doze)", `${f.durationMonths} (${words(f.durationMonths)})`]]],
    [38, [["30 (trinta)", `${f.noticePeriodDays} (${words(f.noticePeriodDays)})`]]],
    [42, [["R$ 500,00 (quinhentos reais)", `${brl(f.implementationFee)} (${reais(f.implementationFee)})`]]],
    [149, [[P["149"], `${f.signatureCity}, ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${f.signatureDate}T12:00:00Z`))}.`]]],
    [156, [[P["156"], firstSignature[0]]]],
    [157, [[P["157"], firstSignature[1]]]],
    [158, [[P["158"], secondSignature[0]]]],
    [159, [[P["159"], secondSignature[1]]]],
    [161, [[P["161"], names.length > 1 ? "CONTRATANTE" : ""]]],
    [175, [["Luana Lima de Oliveira", f.witness1Name]]],
    [176, [["Nome: ", `Nome: ${f.witness2Name}`]]],
    [177, [["114.011.974-50", f.witness1Cpf]]],
    [178, [["CPF: ", `CPF: ${f.witness2Cpf}`]]],
  ]);
  updates.set(2, []);
  updates.set(6, []);
  const pieces = (i: number, p: string) => {
    if (i === 2) {
      const q = f.qualification;
      const firstNameEnd = q.indexOf(", ");
      const firstName = firstNameEnd < 0 ? q : q.slice(0, firstNameEnd);
      const secondName = names[1] ?? "";
      const secondStart = secondName ? q.indexOf(secondName, firstName.length) : -1;
      const rest = q.slice(firstName.length);
      const source = P["2"].slice("CONTRATANTE(S): ".length);
      const sourceFirst = "BRUNA ANDIARA RASCHE HAUPENTHAL";
      const sourceSecond = "JONATHAN HAUPENTHAL";
      const sourceSecondStart = source.indexOf(sourceSecond);
      return substitutePieces(p, [
        [sourceFirst, firstName],
        [source.slice(sourceFirst.length, sourceSecondStart), secondStart < 0 ? rest : q.slice(firstName.length, secondStart)],
        [sourceSecond, secondStart < 0 ? "" : secondName],
        [source.slice(sourceSecondStart + sourceSecond.length), secondStart < 0 ? "" : q.slice(secondStart + secondName.length)],
      ]);
    }
    const m = f.propertyDescription.match(/^Apartamento nº (.*?), Torre (.*?), localizado no (.*?), situado na (.*?)\.?$/);
    if (!m) return substitutePieces(p, [[P["6"], f.propertyDescription]]);
    const [unit = "", tower = "", cond = "", addr = ""] = m.slice(1);
    return substitutePieces(p, [
      ["201", unit], ["VERONA", tower], ["Residencial Vêneto", cond],
      ["Rua Artur Reinheimer, 550 – Bairro Carniel – Gramado/RS – CEP 95670-720.", `${addr.replace(/\.$/, "")}.`],
    ]);
  };
  let index = -1;
  const applied = new Set<number>();
  const result = xml.replace(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g, p => {
    index++;
    const changes = updates.get(index);
    if (!changes) return p;
    const expected = (templateMap.paragraphs as Record<string, string>)[String(index)];
    if (paragraphText(p) !== expected) throw new Error("A minuta mudou. Geração bloqueada para preservar o contrato.");
    applied.add(index);
    if (index === 2 || index === 6) return pieces(index, p);
    return changes.reduce((current, [old, value]) => old === value ? current : substitute(current, old, value), p);
  });
  if (applied.size !== updates.size) throw new Error("Minuta incompleta. Não foi possível gerar o contrato.");
  return result;
}

export function generateContractDocx(original: Uint8Array, fields: ContractDocumentFields): Uint8Array {
  const files = unzipSync(original);
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("Modelo Word inválido.");
  files["word/document.xml"] = strToU8(fillContractXml(strFromU8(xml), fields));
  return zipSync(files);
}