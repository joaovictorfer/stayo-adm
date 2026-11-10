import { formatBrazilianDocument, formatBrazilianPostalCode, maskDocument, maskPixKey } from "./owner-form-validation";
import { conditionSections, formatPercent } from "./contract-conditions";
import { formatBRL } from "./money";
import type { ProposalSnapshotContractConditions } from "@/types/commercial-proposal";

type Person = { name: string; document: string; maritalStatus?: string | null | undefined; profession?: string | null | undefined; email?: string | undefined; phone?: string | undefined };
type Address = { street?: string | null | undefined; number?: string | null | undefined; complement?: string | null | undefined; district?: string | null | undefined; city?: string | null | undefined; state?: string | null | undefined; postalCode?: string | null | undefined };
export type ContractCopyInput = {
  people: Person[];
  ownerAddress: Address;
  property: Address & { unit?: string | null | undefined; tower?: string | null | undefined; condominium?: string | null | undefined };
  conditions: ProposalSnapshotContractConditions;
  pixKey?: string | null | undefined;
};
const missing = "[A DEFINIR]";
const marital: Record<string, string> = { solteiro: "solteiro(a)", casado: "casado(a)", divorciado: "divorciado(a)", viuvo: "viúvo(a)", uniao_estavel: "em união estável", separado: "separado(a)" };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

function addressText(a: Address) {
  return [a.street || missing, a.number, a.complement, a.district ? `Bairro ${a.district}` : null,
    a.city ? `${a.city}${a.state ? `/${a.state}` : ""}` : missing,
    a.postalCode ? `CEP ${formatBrazilianPostalCode(a.postalCode)}` : null].filter(Boolean).join(", ");
}

export function buildContractCopy(input: ContractCopyInput, includeSensitive = false) {
  const c = input.conditions;
  const qualifications = input.people.map(person => {
    const docLabel = person.document.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF";
    const document = person.document ? includeSensitive ? formatBrazilianDocument(person.document) : maskDocument(person.document) : missing;
    return `${person.name.toLocaleUpperCase("pt-BR") || missing}, ${person.maritalStatus ? marital[person.maritalStatus] ?? person.maritalStatus : missing}, ${person.profession || missing}, inscrito(a) no ${docLabel} nº ${document}, residente e domiciliado(a) em ${addressText(input.ownerAddress)}${person.email ? `, e-mail ${person.email}` : ""}${person.phone ? `, telefone ${person.phone}` : ""}.`;
  });
  const contractors = qualifications.length ? qualifications.join("\n\n") : missing;
  const percentage = formatPercent(c.administrationFee);
  const split = c.administrationFee != null && Number.isFinite(c.administrationFee) && c.administrationFee >= 0 && c.administrationFee <= 100
    ? `a) ${formatPercent(100 - c.administrationFee)} ao CONTRATANTE;\nb) ${percentage} ao CONTRATADO;\n(Após dedução da taxa de limpeza.)` : missing;
  const sections = conditionSections(c);
  const ownerUse = sections.find(section => section.key === "owner_use");
  const use = ownerUse ? [ownerUse.items.map(item => `${item.label}: ${item.value}.`).join("\n"), ownerUse.note].filter(Boolean).join("\n") : missing;
  const rows = [
    { title: "1 – IMÓVEL OBJETO:", body: `Apartamento nº ${input.property.unit || missing}${input.property.tower ? `, Torre ${input.property.tower}` : ""}, localizado no ${input.property.condominium || missing}, situado em ${addressText(input.property)}.` },
    { title: "2 – DA TAXA ADMINISTRATIVA:", body: percentage ? `${percentage} sobre o valor líquido da hospedagem.` : missing },
    { title: "3 – DA TAXA DE LIMPEZA:", body: c.cleaningResponsibility?.trim() || sections.find(section => section.key === "cleaning")?.items.map(item => `${item.label}: ${item.value}${item.help ? `. ${item.help}` : ""}`).join("\n") || missing },
    { title: "4 – DA DIVISÃO DOS VALORES:", body: split },
    { title: "5 – DOS REPASSES:", body: `${c.payoutRule?.trim() || missing}\nChave Pix: ${input.pixKey ? includeSensitive ? input.pixKey : maskPixKey(input.pixKey) : missing}` },
    { title: "6 – DO USO PELO CONTRATANTE:", body: use },
    { title: "7 – DO USO PARA MARKETING:", body: missing },
    { title: "8 – DA MANUTENÇÃO EMERGENCIAL:", body: c.maintenanceLimit != null ? `Autorização ao CONTRATADO para intervenções até ${formatBRL(c.maintenanceLimit)} sem autorização prévia. Acima deste valor, exige autorização do CONTRATANTE.` : missing },
    { title: "9 – DA PARALISAÇÃO PERIÓDICA:", body: missing },
  ];
  // Additional saved conditions are not dropped just because the reference ends at item 9.
  if (c.durationMonths != null || c.noticePeriodDays != null || c.exclusivity != null) rows.push({ title: "10 – DEMAIS CONDIÇÕES:", body: [
    c.durationMonths != null ? `Vigência: ${c.durationMonths} meses.` : null,
    c.noticePeriodDays != null ? `Aviso prévio: ${c.noticePeriodDays} dias.` : null,
    c.exclusivity != null ? `Exclusividade: ${c.exclusivity ? "Sim" : "Não"}.` : null,
  ].filter(Boolean).join("\n") });
  const wrap = (content: string) => `<html><body><!--StartFragment--><div style="font-family:Arial,sans-serif;font-size:11pt;color:#000000;line-height:1.15">${content}</div><!--EndFragment--></body></html>`;
  const contractorsHtml = `<p style="text-align:justify;margin:0 0 12pt"><strong>CONTRATANTE(S):</strong> ${escape(contractors).replace(/\n\n/g, "</p><p style=\"text-align:justify;margin:0 0 12pt\">")}</p>`;
  const summaryHtml = `<p style="text-align:center;margin:12pt 0;font-weight:bold;text-decoration:underline">QUADRO RESUMO</p><table style="border-collapse:collapse;width:100%" border="1" cellspacing="0" cellpadding="5">${rows.map(row => `<tr><td style="border:1px solid #000000;vertical-align:top"><strong>${escape(row.title)}</strong><br>${escape(row.body).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`;
  const contractorsText = `CONTRATANTE(S): ${contractors}`;
  const summaryText = `QUADRO RESUMO\n\n${rows.map(row => `${row.title}\n${row.body}`).join("\n\n")}`;
  return { contractorsText, summaryText, text: `${contractorsText}\n\n${summaryText}`, html: wrap(contractorsHtml + summaryHtml), contractorsHtml: wrap(contractorsHtml), summaryHtml: wrap(summaryHtml), rows, qualifications, hasMissing: contractors.includes(missing) || rows.some(row => row.body.includes(missing)) };
}

export async function copyContractToClipboard(html: string, text: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      return "formatted" as const;
    } catch { /* Retain a usable plain-text fallback when rich clipboard is unsupported. */ }
  }
  await navigator.clipboard.writeText(text);
  return "plain" as const;
}