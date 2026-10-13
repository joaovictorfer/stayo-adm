import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Copy, Globe, KeyRound, Landmark, Pencil, UserRound, Users } from "lucide-react";
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

type Line = { label: string; value: string | null | undefined; wide?: boolean };

async function copy(text: string, label = "Copiado") {
  try { await navigator.clipboard.writeText(text); toast.success(label); } catch { toast.error("Não foi possível copiar."); }
}

function useFlash() {
  const [done, setDone] = useState(false);
  return [done, () => { setDone(true); setTimeout(() => setDone(false), 1400); }] as const;
}

function CopyIcon({ done, visible }: { done: boolean; visible?: boolean }) {
  return done ? <Check className="size-3.5 text-[var(--stayo-navy)]" /> : <Copy className={`size-3.5 text-[var(--stayo-ink-muted)] transition ${visible ? "" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`} />;
}

function Field({ label, value, wide }: Line) {
  const [done, flash] = useFlash();
  return <button type="button" disabled={!value} title={value ? "Copiar" : undefined}
    onClick={() => { if (!value) return; void copy(value, `${label} copiado`); flash(); }}
    className={`group min-w-0 rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--stayo-surface-muted,rgba(11,49,80,0.04))] disabled:cursor-default disabled:hover:bg-transparent ${wide ? "col-span-full" : ""}`}>
    <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--stayo-ink-muted)]">{label}</span>
    <span className="mt-0.5 flex items-center gap-1.5">
      <span className={`min-w-0 break-words text-sm ${value ? "font-medium text-[var(--stayo-navy)]" : "text-[var(--stayo-ink-muted)]"}`}>{value || "—"}</span>
      {value && <CopyIcon done={done} />}
    </span>
  </button>;
}

function Section({ title, meta, icon, lines, action, children, empty }: { title: string; meta?: ReactNode; icon: ReactNode; lines?: Line[]; action?: ReactNode; children?: ReactNode; empty?: string }) {
  const filled = (lines ?? []).filter(l => l.value);
  const [done, flash] = useFlash();
  return <section aria-label={title} className="rounded-xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-2 pb-2 pt-3 shadow-[0_1px_2px_rgba(11,49,80,0.04)] sm:px-3">
    <header className="mb-2 flex items-center justify-between gap-3 border-b border-[var(--stayo-border)] px-2 pb-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--ficha-icon-bg)] text-[var(--ficha-icon-fg)] [&_svg]:size-4">{icon}</span>
        <div className="min-w-0">
          <h3 className="truncate font-[Outfit] text-[15px] font-semibold leading-tight text-[var(--stayo-navy)]">{title}</h3>
          {meta && <p className="truncate text-xs text-[var(--stayo-ink-muted)]">{meta}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {action}
        {filled.length > 0 && <button type="button" onClick={() => { void copy(filled.map(l => `${l.label}: ${l.value}`).join("\n"), `${title} copiado`); flash(); }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--stayo-ink-muted)] transition hover:bg-[var(--stayo-surface-muted,rgba(11,49,80,0.05))] hover:text-[var(--stayo-navy)]">
          {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}Copiar
        </button>}
      </div>
    </header>
    {children}
    {lines && (filled.length === 0 && empty
      ? <p className="px-2 text-sm text-[var(--stayo-ink-muted)]">{empty}</p>
      : <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3">{lines.map(l => <Field key={l.label} {...l} />)}</div>)}
  </section>;
}

function Highlight({ label, value, hint, empty }: { label: string; value: string | null | undefined; hint?: string | null; empty: string }) {
  const [done, flash] = useFlash();
  return <button type="button" disabled={!value} onClick={() => { if (!value) return; void copy(value, `${label} copiado`); flash(); }}
    className="group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-3.5 py-3 text-left transition hover:border-[var(--stayo-navy)] disabled:cursor-default disabled:hover:border-[var(--stayo-border)]">
    <span className="min-w-0">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--stayo-ink-muted)]">{label}{hint ? ` · ${hint}` : ""}</span>
      <span className={`mt-0.5 block break-all text-[15px] ${value ? "font-semibold text-[var(--stayo-navy)]" : "text-[var(--stayo-ink-muted)]"}`}>{value || empty}</span>
    </span>
    {value && <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--ficha-icon-bg)]"><CopyIcon done={done} visible /></span>}
  </button>;
}

/** Dossiê cadastral do proprietário (somente leitura, equipe STAYO). */
export function OwnerRegistrationSheet({ implementation, onEditOwner }: { implementation: ImplementationProject; onEditOwner?: (() => void) | undefined }) {
  const sub = useQuery(ownerOnboardingSubmissionQuery(implementation.id)).data;
  const platforms = useQuery({ queryKey: ["implementation-platforms", implementation.id], queryFn: () => getImplementationPlatforms(implementation.id) }).data;
  const details = useQuery({ queryKey: ["property-details", implementation.id], queryFn: () => getPropertyDetails(implementation.id) }).data;
  const num = (n: number | null | undefined) => (n === null || n === undefined ? null : String(n));
  const doc = (d: string | null | undefined) => (d ? formatBrazilianDocument(d) : null);
  const phone = (p: string | null | undefined) => (p ? formatBrazilianPhone(p.replace(/^55(?=\d{10,11}$)/, "")) : null);
  const people = sub?.people ?? [];
  const principal = people[0];
  const name = principal?.fullName || implementation.ownerName || "Proprietário não informado";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
  const channels = platforms?.distribution_channels ?? [];
  const status = !sub ? { text: "Aguardando proprietário", tone: "muted" } : sub.submittedAt ? { text: `Enviada em ${new Date(sub.submittedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, tone: "ok" } : { text: "Em preenchimento", tone: "pending" };
  const property = [implementation.condominiumName, implementation.unit && `Apto ${implementation.unit}`].filter(Boolean).join(" · ");

  return <div className="space-y-3">
    <header className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-4 py-3.5 sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--stayo-navy)] font-[Outfit] text-sm font-semibold text-[var(--stayo-surface)]">{initials || "?"}</span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-[Outfit] text-lg font-semibold leading-tight text-[var(--stayo-navy)]">{name}</h2>
        <p className="truncate text-xs text-[var(--stayo-ink-muted)]">Ficha cadastral{property ? ` · ${property}` : ""}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.tone === "pending" ? "bg-[var(--ficha-pending-bg)] text-[var(--ficha-pending-fg)]" : "bg-[var(--ficha-icon-bg)] text-[var(--ficha-icon-fg)]"}`}>{status.text}</span>
      {onEditOwner && <button type="button" onClick={onEditOwner} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--stayo-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--stayo-navy)] transition hover:border-[var(--stayo-navy)]"><Pencil className="size-3.5" />Editar</button>}
    </header>

    <div className="grid gap-3 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <Highlight icon={<Globe />} label="E-mail da conta Airbnb" value={platforms?.airbnb_account_email} empty="Não informado" />
        {channels.length > 0 && <div className="flex flex-wrap gap-1 px-0.5">{channels.map(c => <span key={c} className="rounded-full border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-2 py-0.5 text-[11px] text-[var(--stayo-ink-muted)]">{CHANNEL_LABELS[c]}</span>)}</div>}
      </div>
      <Highlight icon={<KeyRound />} label="Chave Pix" hint={sub?.pixKey ? pixLabel[sub.pixType] : null} value={sub?.pixKey} empty="Não informada" />
    </div>

    {people.length === 0
      ? <Section icon={<UserRound />} title="Proponentes" lines={[]} empty="Nenhum proponente informado." />
      : people.map((p, i) => <Section key={i} icon={i === 0 ? <UserRound /> : <Users />} title={p.fullName || `Proponente ${i + 1}`} meta={roleLabel[p.role]} lines={[
          { label: "CPF/CNPJ", value: doc(p.document) },
          { label: "Telefone", value: phone(p.phone) },
          { label: "E-mail", value: p.email },
          { label: "Nome completo", value: p.fullName },
          { label: "Estado civil", value: p.maritalStatus ? maritalLabel[p.maritalStatus] ?? p.maritalStatus : null },
          { label: "Profissão", value: p.profession },
        ]} />)}

    <div className="grid items-start gap-3 xl:grid-cols-2">
      <Section icon={<Building2 />} title="Imóvel" meta={property || undefined} lines={[
        { label: "Condomínio", value: implementation.condominiumName },
        { label: "Apartamento", value: implementation.unit },
        { label: "Box / vagas", value: [details?.parkingBox && `Box ${details.parkingBox}`, details?.parkingSpots != null && `${details.parkingSpots} vaga(s)`].filter(Boolean).join(" · ") || null },
        { label: "Quartos", value: num(implementation.bedrooms ?? details?.bedrooms) },
        { label: "Suítes", value: num(details?.suites) },
        { label: "Banheiros / lavabos", value: [num(details?.bathrooms), num(details?.lavatories)].some(Boolean) ? `${details?.bathrooms ?? 0} / ${details?.lavatories ?? 0}` : null },
      ]} />

      <Section icon={<Landmark />} title="Dados bancários" meta="Recebimento dos repasses" empty="Recebimentos ainda não informados." lines={sub ? [
        { label: "Banco", value: sub.bankName },
        { label: "Agência", value: sub.bankBranch },
        { label: "Conta", value: sub.accountNumber },
        { label: "Tipo de conta", value: sub.accountNumber ? accountLabel[sub.accountType] : null },
        { label: "Titular", value: sub.accountHolder },
        { label: "CPF/CNPJ do titular", value: doc(sub.holderTaxId) },
      ] : []} />
    </div>
  </div>;
}
