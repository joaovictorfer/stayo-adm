import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardCopy, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { ownerOnboardingSubmissionQuery } from "../../../lib/api/queries";
import { getImplementationPlatforms, CHANNEL_LABELS } from "../../../lib/api/owner-platforms";
import { getPropertyDetails } from "../../../lib/api/owner-portal-data";
import { formatBrazilianDocument, formatBrazilianPhone } from "../../../lib/owner-form-validation";
import type { ImplementationProject } from "../../../types/core";

const panel = "min-w-0 rounded-lg border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-4 py-3";
const roleLabel = { proprietario: "Proprietário principal", coproprietario: "Coproprietário", proponente: "Proponente" } as const;
const accountLabel = { checking: "Conta corrente", savings: "Poupança", payment: "Conta pagamento" } as const;
const pixLabel = { cpf: "CPF", cnpj: "CNPJ", phone: "Telefone", email: "E-mail", random: "Aleatória" } as const;
const maritalLabel: Record<string, string> = { solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)", viuvo: "Viúvo(a)", uniao_estavel: "União estável", separado: "Separado(a)" };

type Line = { label: string; value: string | null | undefined };

async function copy(text: string, label = "Copiado") {
  try { await navigator.clipboard.writeText(text); toast.success(label); } catch { toast.error("Não foi possível copiar."); }
}

function Block({ title, lines, empty }: { title: string; lines: Line[]; empty?: string }) {
  const filled = lines.filter(l => l.value);
  return <section className={panel} aria-label={title}>
    <div className="mb-1 flex items-center justify-between gap-2">
      <h3 className="font-[Outfit] text-base font-semibold text-[var(--stayo-navy)]">{title}</h3>
      {filled.length > 0 && <Button variant="ghost" size="sm" onClick={() => void copy(filled.map(l => `${l.label}: ${l.value}`).join("\n"), `${title} copiado`)}><ClipboardCopy /> Copiar bloco</Button>}
    </div>
    {filled.length === 0 && empty ? <p className="py-2 text-sm text-[var(--stayo-ink-muted)]">{empty}</p> :
      <dl>{lines.map(l => <CopyRow key={l.label} {...l} />)}</dl>}
  </section>;
}

function CopyRow({ label, value }: Line) {
  const [done, setDone] = useState(false);
  return <div className="flex min-h-10 items-center gap-3 border-b border-[var(--stayo-border)] py-1.5 last:border-b-0">
    <dt className="w-32 shrink-0 text-sm text-[var(--stayo-ink-muted)] sm:w-40">{label}</dt>
    <dd className="min-w-0 flex-1 break-words text-sm font-medium">{value || <span className="font-normal text-[var(--stayo-ink-muted)]">Não informado</span>}</dd>
    {value && <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Copiar ${label}`} onClick={() => { void copy(value, `${label} copiado`); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? <Check /> : <Copy />}</Button>}
  </div>;
}

/** Ficha de cadastro enviada pelo proprietário, em blocos copiáveis (somente leitura, equipe STAYO). */
export function OwnerRegistrationSheet({ implementation }: { implementation: ImplementationProject }) {
  const sub = useQuery(ownerOnboardingSubmissionQuery(implementation.id)).data;
  const platforms = useQuery({ queryKey: ["implementation-platforms", implementation.id], queryFn: () => getImplementationPlatforms(implementation.id) }).data;
  const details = useQuery({ queryKey: ["property-details", implementation.id], queryFn: () => getPropertyDetails(implementation.id) }).data;
  const num = (n: number | null | undefined) => (n === null || n === undefined ? null : String(n));
  const doc = (d: string | null | undefined) => (d ? formatBrazilianDocument(d) : null);
  const phone = (p: string | null | undefined) => (p ? formatBrazilianPhone(p.replace(/^55(?=\d{10,11}$)/, "")) : null);
  const people = sub?.people ?? [];

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-[Outfit] text-lg font-semibold">Ficha de cadastro</h3>
        <p className="text-xs text-[var(--stayo-ink-muted)]">{!sub ? "O proprietário ainda não preencheu." : sub.submittedAt ? `Enviada em ${new Date(sub.submittedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Em preenchimento pelo proprietário"} · use os botões para copiar para o contrato ou sistemas.</p></div>
    </div>
    {people.length === 0
      ? <Block title="Proponentes" lines={[]} empty="Nenhum proponente informado." />
      : people.map((person, i) => <Block key={i} title={people.length > 1 ? `${roleLabel[person.role]} ${i + 1}` : "Proponente"} lines={[
          { label: "Nome completo", value: person.fullName },
          { label: "CPF/CNPJ", value: doc(person.document) },
          { label: "E-mail", value: person.email },
          { label: "Telefone", value: phone(person.phone) },
          { label: "Estado civil", value: person.maritalStatus ? maritalLabel[person.maritalStatus] ?? person.maritalStatus : null },
          { label: "Profissão", value: person.profession },
        ]} />)}
    <Block title="Airbnb e canais" lines={[
      { label: "E-mail do Airbnb", value: platforms?.airbnb_account_email },
      { label: "Canais", value: platforms?.distribution_channels?.length ? platforms.distribution_channels.map(c => CHANNEL_LABELS[c]).join(", ") : null },
    ]} />
    <Block title="Dados do imóvel" lines={[
      { label: "Condomínio", value: implementation.condominiumName },
      { label: "Apartamento", value: implementation.unit },
      { label: "Box", value: details?.parkingBox },
      { label: "Quartos", value: num(details?.bedrooms ?? implementation.bedrooms) },
      { label: "Suítes", value: num(details?.suites) },
      { label: "Banheiros", value: num(details?.bathrooms) },
      { label: "Lavabos", value: num(details?.lavatories) },
      { label: "Vagas", value: num(details?.parkingSpots) },
    ]} />
    <Block title="Dados financeiros" lines={sub ? [
      { label: "Chave Pix", value: sub.pixKey },
      { label: "Tipo da chave", value: sub.pixKey ? pixLabel[sub.pixType] : null },
      { label: "Banco", value: sub.bankName },
      { label: "Agência", value: sub.bankBranch },
      { label: "Conta", value: sub.accountNumber },
      { label: "Tipo de conta", value: sub.accountNumber ? accountLabel[sub.accountType] : null },
      { label: "Titular", value: sub.accountHolder },
      { label: "CPF/CNPJ do titular", value: doc(sub.holderTaxId) },
    ] : []} empty="Recebimentos ainda não informados." />
  </div>;
}
