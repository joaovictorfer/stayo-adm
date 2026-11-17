import { z } from "zod";
import { isValidCivilDate, type ContractDocumentFields } from "./contract-document";
import { isValidCpf, isValidCnpj, normalizePhone } from "./owner-form-validation";
import type { OwnerOnboardingSubmission } from "@/types/owner-onboarding";

const text = z.string().trim().min(1, "Informe este dado").max(4000);
export const contractPartySchema = z.object({
  personType: z.enum(["pf", "pj"]),
  fullName: text.max(150), document: text.max(20),
  email: z.string().trim().email("Informe um e-mail válido"),
  phone: text.refine(v => /^55\d{10,11}$/.test(normalizePhone(v)), "Informe um telefone válido com DDD"),
  maritalStatus: z.string().trim().max(40), profession: z.string().trim().max(150),
  address: text.max(800), representative: z.string().trim().max(1000),
}).superRefine((p, ctx) => {
  const issue = (key: string, message: string) => ctx.addIssue({ code: "custom", path: [key], message });
  if (p.personType === "pf") {
    if (p.fullName.split(/\s+/).length < 2) issue("fullName", "Informe o nome completo");
    if (!isValidCpf(p.document)) issue("document", "CPF inválido");
    if (!p.maritalStatus) issue("maritalStatus", "Informe o estado civil");
    if (!p.profession) issue("profession", "Informe a profissão");
  } else {
    if (!isValidCnpj(p.document)) issue("document", "CNPJ inválido");
    if (!p.representative) issue("representative", "Informe a qualificação do representante legal");
  }
});
export type ContractParty = z.infer<typeof contractPartySchema>;
const maritalLabels: Record<string, string> = { solteiro: "solteiro(a)", casado: "casado(a)", uniao_estavel: "união estável", divorciado: "divorciado(a)", separado: "separado(a)", viuvo: "viúvo(a)" };
export function buildQualification(parties: ContractParty[]): string {
  const sharedAddress = parties.length === 2 && parties.every(p => p.personType === "pf") && parties[0]?.address.trim() === parties[1]?.address.trim();
  if (sharedAddress) {
    const qualification = parties.map(p => [p.fullName.trim().toUpperCase(), maritalLabels[p.maritalStatus] ?? p.maritalStatus, p.profession, `inscrito(a) no CPF nº ${p.document}`, `e-mail ${p.email}`, `telefone ${p.phone}`].join(", ")).join(" e ");
    return `${qualification}; ambos residentes e domiciliados no endereço ${parties[0]?.address.trim()}.`;
  }
  return parties.map(p => [p.fullName.trim().toUpperCase(),
    ...(p.personType === "pf" ? [maritalLabels[p.maritalStatus] ?? p.maritalStatus, p.profession, `inscrito(a) no CPF nº ${p.document}`, `residente e domiciliado(a) em ${p.address}`] : [`inscrita no CNPJ nº ${p.document}`, `com sede em ${p.address}`, `representada por ${p.representative}`]),
    `e-mail ${p.email}`, `telefone ${p.phone}`].join(", ")).join("; ") + ".";
}
export function initialContractParties(o: OwnerOnboardingSubmission): ContractParty[] {
  const address = [o.street, o.number, o.complement, o.district, [o.city, o.state].filter(Boolean).join("/"), o.postalCode && `CEP ${o.postalCode}`].filter(Boolean).join(", ");
  const people = o.people.length ? o.people : [{ personType: o.personType, fullName: o.fullName, document: o.document, email: o.email, phone: o.phone, maritalStatus: "", profession: "" }];
  return people.map((p, i) => ({ personType: p.personType ?? "pf", fullName: p.fullName, document: p.document,
    email: p.email || (i === 0 ? o.email : ""), phone: p.phone || (i === 0 ? o.phone : ""),
    maritalStatus: p.maritalStatus ?? "", profession: p.profession ?? "", address: i === 0 ? address : "", representative: "" }));
}
export const contractFieldsSchema = z.object({
  parties: z.array(contractPartySchema).min(1).max(10),
  qualification: text, propertyDescription: text, pixKey: text.max(200), signatureNames: text.max(500),
  signatureDate: z.string().refine(isValidCivilDate, "Data inexistente"), signatureCity: text.max(100),
  administrationFee: z.number().min(0).max(100), durationMonths: z.number().int().min(1).max(99),
  maintenanceLimit: z.number().min(0).max(1000000), noticePeriodDays: z.number().int().min(0).max(99),
  exclusivity: z.boolean(), payoutMode: z.enum(["day10_report", "platform_auto"]), ownerUseNoticeDays: z.number().int().min(0).max(99), implementationFee: z.number().min(0).max(999999),
  witness1Name: text.max(150), witness1Cpf: text.max(20).refine(isValidCpf, "CPF inválido"),
  witness2Name: z.string().trim().max(150).default(""), witness2Cpf: z.string().trim().max(20).default(""),
  summaryTexts: z.object({ payout: z.string().trim().max(2000).optional(), ownerUse: z.string().trim().max(2000).optional(), marketing: z.string().trim().max(2000).optional(), periodicShutdown: z.string().trim().max(2000).optional() }).optional(),
}).superRefine((f, ctx) => {
  if (!f.witness2Name && !f.witness2Cpf) return;
  if (!f.witness2Name) ctx.addIssue({ code: "custom", path: ["witness2Name"], message: "Informe o nome da segunda testemunha" });
  if (!isValidCpf(f.witness2Cpf)) ctx.addIssue({ code: "custom", path: ["witness2Cpf"], message: f.witness2Cpf ? "CPF inválido" : "Informe o CPF da segunda testemunha" });
}).transform(f => ({ ...f, qualification: buildQualification(f.parties), signatureNames: f.parties.map(p => p.fullName.trim().toUpperCase()).join(" / ") }));
export type PreparedContractFields = Omit<ContractDocumentFields, "parties"> & { parties: ContractParty[] };