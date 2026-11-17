import type { PreparedContractFields } from "@/lib/contract-preparation";
import { buildContractCopy } from '@/lib/contract-copy';
import { implementationText } from '@/lib/contract-standard-clauses';
import { reais } from '@/lib/contract-document';

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ContractReview({ fields }: { fields: PreparedContractFields }) {
  const { rows } = buildContractCopy({ people: [], ownerAddress: {}, property: {}, pixKey: fields.pixKey,
    conditions: { administrationFee: fields.administrationFee, durationMonths: fields.durationMonths,
      maintenanceLimit: fields.maintenanceLimit, noticePeriodDays: fields.noticePeriodDays, exclusivity: fields.exclusivity,
      payoutRule: fields.summaryTexts?.payout ?? null, ownerUseNotes: fields.summaryTexts?.ownerUse ?? null,
      marketingRule: fields.summaryTexts?.marketing ?? null, periodicShutdownRule: fields.summaryTexts?.periodicShutdown ?? null } }, true);
  rows[0] = { title: rows[0]?.title ?? '1 – IMÓVEL OBJETO:', body: fields.propertyDescription };
  rows[14] = { title: rows[14]?.title ?? '15 – DA IMPLANTAÇÃO:', body: implementationText(money(fields.implementationFee), reais(fields.implementationFee)) };
  const entries: [string, string][] = [
    ["Administração", `${fields.administrationFee}%`], ["Vigência", `${fields.durationMonths} meses`],
    ["Manutenção emergencial", money(fields.maintenanceLimit)], ["Implantação", money(fields.implementationFee)],
    ["Rescisão", `${fields.noticePeriodDays} dias`],
    ["Exclusividade", fields.exclusivity ? "Sim" : "Não"],
    ["Repasse", "Automático pela plataforma; se indisponível, até dia 10"],
    ["Chave Pix", fields.pixKey], ["Local e data", `${fields.signatureCity} · ${fields.signatureDate.split("-").reverse().join("/")}`],
  ];
  return <div className="space-y-6 break-words">
    <section className="space-y-2"><h3 className="font-semibold">Contratantes</h3><p className="text-sm leading-relaxed">{fields.qualification}</p></section>
    <section className="space-y-2 border-t border-border pt-5"><h3 className="font-semibold">Imóvel</h3><p className="text-sm leading-relaxed">{fields.propertyDescription}</p></section>
    <section className="space-y-3 border-t border-border pt-5"><h3 className="font-semibold">Condições comerciais</h3><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{entries.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl></section>
    <section className="space-y-3 border-t border-border pt-5"><h3 className="font-semibold text-primary">Quadro Resumo</h3>{rows.map(row => <div key={row.title} className="border-b border-border pb-3 last:border-0"><h4 className="text-sm font-semibold">{row.title}</h4><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{row.body}</p></div>)}</section>
    <section className="space-y-3 border-t border-border pt-5"><h3 className="font-semibold text-primary">Assinaturas e testemunhas</h3><p className="text-sm font-medium">{fields.signatureNames}</p><p className="text-sm">{fields.witness1Name} · CPF {fields.witness1Cpf}</p>{fields.witness2Name && <p className="text-sm">{fields.witness2Name} · CPF {fields.witness2Cpf}</p>}</section>
  </div>;
}