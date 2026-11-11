import type { PreparedContractFields } from "@/lib/contract-preparation";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ContractReview({ fields }: { fields: PreparedContractFields }) {
  const entries: [string, string][] = [
    ["Administração", `${fields.administrationFee}%`], ["Vigência", `${fields.durationMonths} meses`],
    ["Manutenção emergencial", money(fields.maintenanceLimit)], ["Implantação", money(fields.implementationFee)],
    ["Rescisão", `${fields.noticePeriodDays} dias`], ["Antecedência de uso", `${fields.ownerUseNoticeDays} dias`],
    ["Exclusividade", fields.exclusivity ? "Sim" : "Não"],
    ["Repasse", fields.payoutMode === "platform_auto" ? "Automático, com alternativa até dia 10" : "STAYO até dia 10, com relatório"],
    ["Chave Pix", fields.pixKey], ["Local e data", `${fields.signatureCity} · ${fields.signatureDate.split("-").reverse().join("/")}`],
  ];
  return <div className="space-y-6 break-words">
    <section className="space-y-2"><h3 className="font-semibold">Contratantes</h3><p className="text-sm leading-relaxed">{fields.qualification}</p></section>
    <section className="space-y-2 border-t border-border pt-5"><h3 className="font-semibold">Imóvel</h3><p className="text-sm leading-relaxed">{fields.propertyDescription}</p></section>
    <section className="space-y-3 border-t border-border pt-5"><h3 className="font-semibold">Condições comerciais</h3><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{entries.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl></section>
    <section className="space-y-3 border-t border-border pt-5"><h3 className="font-semibold">Assinaturas e testemunhas</h3><p className="text-sm">{fields.signatureNames}</p><p className="text-sm">{fields.witness1Name} · CPF {fields.witness1Cpf}</p><p className="text-sm">{fields.witness2Name} · CPF {fields.witness2Cpf}</p></section>
  </div>;
}