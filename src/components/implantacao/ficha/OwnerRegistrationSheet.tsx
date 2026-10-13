import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ClipboardCopy, Copy, Globe, Landmark, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { ownerOnboardingSubmissionQuery } from "../../../lib/api/queries";
import { getImplementationPlatforms, CHANNEL_LABELS } from "../../../lib/api/owner-platforms";
import { getPropertyDetails } from "../../../lib/api/owner-portal-data";
import { formatBrazilianDocument, formatBrazilianPhone } from "../../../lib/owner-form-validation";
import type { ImplementationProject } from "../../../types/core";

const roleLabel = { proprietario: "Proprietário principal", coproprietario: "Coproprietário", proponente: "Proponente" } as const;
const accountLabel = { checking: "Conta corrente", savings: "Poupança", payment: "Conta pagamento" } as const;
const pixLabel = { cpf: "CPF", cnpj: "CNPJ", phone: "Telefone", email: "E-mail", random: "Aleatória" } as const;
const maritalLabel: Record<string, string> = { solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)", viuvo: "Viúvo(a)", uniao_estavel: "União estável", separado: "Separado(a)" };

type Line = { label: string; value: string | null | undefined; wide?: boolean };

async function copy(text: string, label = "Copiado") {
  try { await navigator.clipboard.writeText(text); toast.success(label); } catch { toast.error("Não foi possível copiar."); }
}

function Block({ title, icon, badge, lines, empty, children }: { title: string; icon: ReactNode; badge?: string; lines: Line[]; empty?: string; children?: ReactNode }) {
  const filled = lines.filter(l => l.value);
  return <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)]" aria-label={title}>
    <header className="flex items-center justify-between gap-2 border-b border-[var(--stayo-border)] px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ficha-icon-bg)] text-[var(--ficha-icon-fg)] [&_svg]:size-4">{icon}</span>
        <div className="min-w-0">
          <h3 className="truncate font-[Outfit] text-base font-semibold text-[var(--stayo-navy)]">{title}</h3>
          {badge && <p className="text-xs text-[var(--stayo-ink-muted)]">{badge}</p>}
        </div>
      </div>
      {filled.length > 0 && <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void copy(filled.map(l => `${l.label}: ${l.value}`).join("\n"), `${title} copiado`)}><ClipboardCopy /><span className="hidden sm:inline">Copiar bloco</span></Button>}
    </header>
    {children}
    {filled.length === 0 && empty ? <p className="px-4 py-4 text-sm text-[var(--stayo-ink-muted)] sm:px-5">{empty}</p> :
      lines.length > 0 && <dl className="grid gap-px bg-[var(--stayo-border)] sm:grid-cols-2">{lines.map(l => <CopyCell key={l.label} {...l} />)}</dl>}
  </section>;
}

function CopyCell({ label, value, wide }: Line) {
  const [done, setDone] = useState(false);
  return <div className={`group flex min-h-16 min-w-0 items-center gap-2 bg-[var(--stayo-surface)] px-4 py-2.5 sm:px-5 ${wide ? "sm:col-span-2" : ""}`}>
    <div className="min-w-0 flex-1">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--stayo-ink-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-[var(--stayo-navy)]">{value || <span className="font-normal text-[var(--stayo-ink-muted)]">Não informado</span>}</dd>
    </div>
    {value && <Button variant="ghost" size="icon" className="size-9 shrink-0 opacity-70 group-hover:opacity-100" aria-label={`Copiar ${label}`} onClick={() => { void copy(value, `${label} copiado`); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? <Check /> : <Copy />}</Button>}
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
  const airbnb = platforms?.airbnb_account_email;
  const status = !sub ? "Aguardando preenchimento" : sub.submittedAt ? `Enviada em ${new Date(sub.submittedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : "Em preenchimento";

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--ficha-subtle)] px-4 py-3">
      <p className="text-sm text-[var(--stayo-navy)]"><span className="font-semibold">{status}</span><span className="text-[var(--stayo-ink-muted)]"> · toque no ícone para copiar cada campo</span></p>
      <span className="text-xs text-[var(--stayo-ink-muted)]">{people.length} {people.length === 1 ? "proponente" : "proponentes"}</span>
    </div>

    <Block title="Airbnb e canais" icon={<Globe />} lines={[{ label: "Canais", value: platforms?.distribution_channels?.length ? platforms.distribution_channels.map(c => CHANNEL_LABELS[c]).join(", ") : null, wide: true }]}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stayo-border)] bg-[var(--ficha-subtle)] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--stayo-ink-muted)]">E-mail da conta Airbnb</p>
          <p className="break-all font-[Outfit] text-lg font-semibold text-[var(--stayo-navy)]">{airbnb || <span className="text-sm font-normal text-[var(--stayo-ink-muted)]">Não informado</span>}</p>
        </div>
        {airbnb && <Button size="sm" onClick={() => void copy(airbnb, "E-mail do Airbnb copiado")}><Copy /> Copiar e-mail</Button>}
      </div>
    </Block>

    {people.length === 0
      ? <Block title="Proponentes" icon={<UserRound />} lines={[]} empty="Nenhum proponente informado." />
      : people.map((person, i) => <Block key={i} icon={<UserRound />} title={person.fullName || `Proponente ${i + 1}`} badge={roleLabel[person.role]} lines={[
          { label: "CPF/CNPJ", value: doc(person.document) },
          { label: "Telefone", value: phone(person.phone) },
          { label: "E-mail", value: person.email, wide: true },
          { label: "Estado civil", value: person.maritalStatus ? maritalLabel[person.maritalStatus] ?? person.maritalStatus : null },
          { label: "Profissão", value: person.profession },
          { label: "Nome completo", value: person.fullName, wide: true },
        ]} />)}

    <Block title="Dados do imóvel" icon={<Building2 />} lines={[
      { label: "Condomínio", value: implementation.condominiumName },
      { label: "Apartamento", value: implementation.unit },
      { label: "Box", value: details?.parkingBox },
      { label: "Vagas", value: num(details?.parkingSpots) },
      { label: "Quartos", value: num(details?.bedrooms ?? implementation.bedrooms) },
      { label: "Suítes", value: num(details?.suites) },
      { label: "Banheiros", value: num(details?.bathrooms) },
      { label: "Lavabos", value: num(details?.lavatories) },
    ]} />

    <Block title="Dados financeiros" icon={<Landmark />} lines={sub ? [
      { label: "Chave Pix", value: sub.pixKey },
      { label: "Tipo da chave", value: sub.pixKey ? pixLabel[sub.pixType] : null },
      { label: "Banco", value: sub.bankName },
      { label: "Tipo de conta", value: sub.accountNumber ? accountLabel[sub.accountType] : null },
      { label: "Agência", value: sub.bankBranch },
      { label: "Conta", value: sub.accountNumber },
      { label: "Titular", value: sub.accountHolder },
      { label: "CPF/CNPJ do titular", value: doc(sub.holderTaxId) },
    ] : []} empty="Recebimentos ainda não informados." />
  </div>;
}
