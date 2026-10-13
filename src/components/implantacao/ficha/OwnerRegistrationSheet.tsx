import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Copy, Globe, Landmark, Pencil, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ownerOnboardingSubmissionQuery } from "../../../lib/api/queries";
import { getImplementationPlatforms, CHANNEL_LABELS } from "../../../lib/api/owner-platforms";
import { getPropertyDetails } from "../../../lib/api/owner-portal-data";
import { formatBrazilianDocument, formatBrazilianPhone } from "../../../lib/owner-form-validation";
import type { ImplementationProject } from "../../../types/core";

const roleLabel = { proprietario: "Proprietário principal", coproprietario: "Coproprietário", proponente: "Proponente" } as const;
const accountLabel = { checking: "Conta corrente", savings: "Poupança", payment: "Conta pagamento" } as const;
const pixLabel = { cpf: "CPF", cnpj: "CNPJ", phone: "Telefone", email: "E-mail", random: "Aleatória" } as const;
const maritalLabel: Record<string, string> = { solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)", viuvo: "Viúvo(a)", uniao_estavel: "União estável", separado: "Separado(a)" };

const display = { fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "-0.01em", color: "var(--stayo-navy)" };
type Line = { label: string; value: string | null | undefined };

async function copy(text: string, label = "Copiado") {
  try { await navigator.clipboard.writeText(text); toast.success(label); } catch { toast.error("Não foi possível copiar."); }
}

function Block({ title, subtitle, icon, lines, empty, action, children }: { title: string; subtitle?: string; icon: ReactNode; lines: Line[]; empty?: string; action?: ReactNode; children?: ReactNode }) {
  const filled = lines.filter(l => l.value);
  return <section className="rounded-xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-4 pb-1 pt-3 sm:px-5" aria-label={title}>
    <div className="flex items-center justify-between gap-2 border-b border-[var(--stayo-border)] pb-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ficha-icon-bg)] text-[var(--ficha-icon-fg)] [&_svg]:size-4">{icon}</span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold" style={display}>{title}</h3>
          {subtitle && <p className="truncate text-xs text-[var(--stayo-ink-muted)]">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {action}
        {filled.length > 0 && <button type="button" className="text-sm font-medium text-[var(--stayo-navy)] underline underline-offset-2" onClick={() => void copy(filled.map(l => `${l.label}: ${l.value}`).join("\n"), `${title} copiado`)}>Copiar bloco</button>}
      </div>
    </div>
    {children}
    {filled.length === 0 && empty ? <p className="py-3 text-sm text-[var(--stayo-ink-muted)]">{empty}</p> : <ul>{lines.map(l => <Row key={l.label} {...l} />)}</ul>}
  </section>;
}

function Row({ label, value }: Line) {
  const [done, setDone] = useState(false);
  return <li className="border-b border-[var(--stayo-border)] last:border-b-0">
    <button type="button" disabled={!value} title={value ? "Clique para copiar" : undefined}
      onClick={() => { if (!value) return; void copy(value, `${label} copiado`); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-left text-sm disabled:cursor-default sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto]">
      <span className="font-medium text-[var(--stayo-navy)]">{label}</span>
      <span className={`col-start-1 row-start-2 break-words sm:col-start-2 sm:row-start-1 ${value ? "text-[var(--stayo-ink)]" : "text-[var(--stayo-ink-muted)]"}`}>{value || "Não informado"}</span>
      <span className="row-span-2 text-[var(--stayo-ink-muted)] sm:row-span-1">{value ? (done ? <Check className="size-4" /> : <Copy className="size-4 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />) : <span className="block size-4" />}</span>
    </button>
  </li>;
}

/** Ficha de cadastro do proprietário em linhas copiáveis (somente leitura, equipe STAYO). */
export function OwnerRegistrationSheet({ implementation, onEditOwner }: { implementation: ImplementationProject; onEditOwner?: () => void }) {
  const sub = useQuery(ownerOnboardingSubmissionQuery(implementation.id)).data;
  const platforms = useQuery({ queryKey: ["implementation-platforms", implementation.id], queryFn: () => getImplementationPlatforms(implementation.id) }).data;
  const details = useQuery({ queryKey: ["property-details", implementation.id], queryFn: () => getPropertyDetails(implementation.id) }).data;
  const num = (n: number | null | undefined) => (n === null || n === undefined ? null : String(n));
  const doc = (d: string | null | undefined) => (d ? formatBrazilianDocument(d) : null);
  const phone = (p: string | null | undefined) => (p ? formatBrazilianPhone(p.replace(/^55(?=\d{10,11}$)/, "")) : null);
  const people = sub?.people ?? [];
  const airbnb = platforms?.airbnb_account_email;
  const status = !sub ? "Aguardando preenchimento pelo proprietário" : sub.submittedAt ? `Enviada em ${new Date(sub.submittedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : "Em preenchimento pelo proprietário";
  const edit = onEditOwner && <button type="button" onClick={onEditOwner} aria-label="Editar dados do proprietário" className="text-[var(--stayo-navy)]"><Pencil className="size-4" /></button>;

  return <div className="space-y-3">
    <p className="text-sm text-[var(--stayo-ink-muted)]">{status} · clique em um valor para copiar</p>

    {people.length === 0
      ? <Block title="Proponentes" icon={<UserRound />} lines={[]} empty="Nenhum proponente informado." action={edit} />
      : people.map((person, i) => <Block key={i} icon={<UserRound />} title={person.fullName || `Proponente ${i + 1}`} subtitle={roleLabel[person.role]} action={i === 0 ? edit : undefined} lines={[
          { label: "Nome completo", value: person.fullName },
          { label: "CPF/CNPJ", value: doc(person.document) },
          { label: "Telefone", value: phone(person.phone) },
          { label: "E-mail", value: person.email },
          { label: "Estado civil", value: person.maritalStatus ? maritalLabel[person.maritalStatus] ?? person.maritalStatus : null },
          { label: "Profissão", value: person.profession },
        ]} />)}

    <Block title="Airbnb e canais" icon={<Globe />} lines={[
      { label: "E-mail da conta Airbnb", value: airbnb },
      { label: "Canais", value: platforms?.distribution_channels?.length ? platforms.distribution_channels.map(c => CHANNEL_LABELS[c]).join(", ") : null },
    ]} />

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

    <Block title="Dados financeiros" icon={<Landmark />} empty="Recebimentos ainda não informados." lines={sub ? [
      { label: "Chave Pix", value: sub.pixKey },
      { label: "Tipo da chave", value: sub.pixKey ? pixLabel[sub.pixType] : null },
      { label: "Banco", value: sub.bankName },
      { label: "Tipo de conta", value: sub.accountNumber ? accountLabel[sub.accountType] : null },
      { label: "Agência", value: sub.bankBranch },
      { label: "Conta", value: sub.accountNumber },
      { label: "Titular", value: sub.accountHolder },
      { label: "CPF/CNPJ do titular", value: doc(sub.holderTaxId) },
    ] : []} />
  </div>;
}
