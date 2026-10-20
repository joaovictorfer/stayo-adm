import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, Copy, Eye, EyeOff, Globe, KeyRound, Landmark, MapPin, Pencil, UserRound, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { ownerOnboardingSubmissionQuery } from "../../../lib/api/queries";
import { getImplementationPlatforms, CHANNEL_LABELS } from "../../../lib/api/owner-platforms";
import { getPropertyDetails } from "../../../lib/api/owner-portal-data";
import { formatBrazilianDocument, formatBrazilianPhone, maskDocument, maskPixKey } from "../../../lib/owner-form-validation";
import type { ImplementationProject } from "../../../types/core";

const roleLabel = { proprietario: "Proprietário principal", coproprietario: "Coproprietário", proponente: "Proponente" } as const;
const accountLabel = { checking: "Conta corrente", savings: "Poupança", payment: "Conta pagamento" } as const;
const pixLabel = { cpf: "CPF", cnpj: "CNPJ", phone: "Telefone", email: "E-mail", random: "Aleatória" } as const;
const maritalLabel: Record<string, string> = { solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)", viuvo: "Viúvo(a)", uniao_estavel: "União estável", separado: "Separado(a)" };
type Line = { label: string; value: string | null | undefined; wide?: boolean; concealed?: boolean };

async function copy(text: string, label: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); toast.success(label); return true; }
  catch { toast.error("Não foi possível copiar."); return false; }
}

function Field({ label, value, wide, concealed }: Line) {
  const [done, setDone] = useState(false);
  return <div className={`min-w-0 py-1 ${wide ? "col-span-full" : ""}`}>
    <dt className="text-xs text-[var(--stayo-ink-muted)]">{label}</dt>
    <dd className="mt-0.5 flex min-h-7 items-start gap-1">
      <span className={`min-w-0 flex-1 break-words text-sm ${value ? "font-medium text-[var(--stayo-navy)]" : "text-[var(--stayo-ink-muted)]"}`}>{value || "Não informado"}</span>
      {value && !concealed && <Button variant="ghost" size="icon" title={`Copiar ${label}`} aria-label={`Copiar ${label}`} className="size-7 shrink-0 max-sm:size-8 text-[var(--stayo-ink-muted)]" onClick={async () => {
        if (await copy(value, `${label} copiado`)) { setDone(true); setTimeout(() => setDone(false), 1400); }
      }}>{done ? <Check /> : <Copy />}</Button>}
    </dd>
  </div>;
}

function Fields({ lines }: { lines: Line[] }) {
  return <dl className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2">{lines.map(line => <Field key={line.label} {...line} />)}</dl>;
}

function Section({ title, meta, icon, lines, children, empty }: { title: string; meta?: ReactNode; icon: ReactNode; lines?: Line[]; children?: ReactNode; empty?: string }) {
  return <section aria-label={title} className="min-w-0 border-t border-[var(--stayo-border)] py-4">
    <header className="mb-3 flex min-w-0 items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--ficha-icon-bg)] text-[var(--ficha-icon-fg)] [&_svg]:size-4">{icon}</span>
      <div className="min-w-0"><h3 className="font-[Outfit] text-base font-semibold text-[var(--stayo-navy)]">{title}</h3>{meta && <p className="text-xs text-[var(--stayo-ink-muted)]">{meta}</p>}</div>
    </header>
    {children}
    {lines && (empty && !lines.some(line => line.value) ? <p className="text-sm text-[var(--stayo-ink-muted)]">{empty}</p> : <Fields lines={lines} />)}
  </section>;
}

/** One presentation of existing registration records; no parallel owner store. */
export function OwnerRegistrationSheet({ implementation, onEditOwner }: { implementation: ImplementationProject; onEditOwner?: (() => void) | undefined }) {
  const subQ = useQuery(ownerOnboardingSubmissionQuery(implementation.id));
  const platformQ = useQuery({ queryKey: ["implementation-platforms", implementation.id], queryFn: () => getImplementationPlatforms(implementation.id) });
  const detailsQ = useQuery({ queryKey: ["property-details", implementation.id], queryFn: () => getPropertyDetails(implementation.id) });
  const sub = subQ.data;
  const platforms = platformQ.data;
  const details = detailsQ.data;
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const num = (n: number | null | undefined) => n == null ? null : String(n);
  const doc = (d: string | null | undefined) => d ? revealed ? formatBrazilianDocument(d) : maskDocument(d) : null;
  const sensitive = (v: string | null | undefined) => v ? revealed ? v : maskPixKey(v) : null;
  const phone = (p: string | null | undefined) => p ? formatBrazilianPhone(p.replace(/^55(?=\d{10,11}$)/, "")) : null;
  const people = sub?.people ?? [];
  const name = people[0]?.fullName || sub?.fullName || implementation.ownerName || "Proprietário não informado";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
  const channels = platforms?.distribution_channels ?? [];
  const status = subQ.isPending ? "Carregando cadastro…" : subQ.isError ? "Cadastro indisponível" : !sub ? "Aguardando cadastro" : sub.submittedAt ? `Recebido em ${new Date(sub.submittedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Em preenchimento";
  const property = [implementation.condominiumName, implementation.unit && `Unidade ${implementation.unit}`].filter(Boolean).join(" · ");

  return <div className="min-w-0 text-[var(--stayo-navy)]">
    <header className="flex items-start gap-3 pb-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--stayo-navy)] font-[Outfit] text-sm font-semibold text-[var(--stayo-surface)]">{initials || "?"}</span>
      <div className="min-w-0 flex-1"><h2 className="break-words font-[Outfit] text-lg font-semibold leading-snug">{name}</h2><p className="mt-0.5 text-xs text-[var(--stayo-ink-muted)]">{status}</p></div>
      {onEditOwner && <Button variant="outline" size="icon" title="Editar dados do proprietário" aria-label="Editar dados do proprietário" onClick={onEditOwner}><Pencil /></Button>}
    </header>
    <div className="mb-3 flex justify-end"><Button variant="ghost" size="sm" aria-pressed={revealed} onClick={() => setRevealed(value => !value)} className="text-[var(--stayo-ink-muted)]">{revealed ? <EyeOff /> : <Eye />}{revealed ? "Ocultar dados sensíveis" : "Mostrar dados sensíveis"}</Button></div>
    {subQ.isError && <p role="alert" className="mb-3 text-sm text-destructive">Não foi possível carregar o cadastro. <Button variant="link" size="sm" onClick={() => void subQ.refetch()}>Tentar novamente</Button></p>}
    <div className="grid gap-x-5 sm:grid-cols-2">
      <Section title="Conta Airbnb" icon={<Globe />} lines={[{ label: "E-mail do cadastro", value: platformQ.isPending ? "Carregando…" : platformQ.isError ? null : platforms?.airbnb_account_email, concealed: platformQ.isPending }]}>
        {platformQ.isError && <p role="alert" className="mb-2 text-sm text-destructive">Não foi possível carregar as plataformas. <Button variant="link" size="sm" onClick={() => void platformQ.refetch()}>Tentar novamente</Button></p>}
        {channels.length > 0 && <p className="mb-2 break-words text-xs text-[var(--stayo-ink-muted)]">{channels.map(c => CHANNEL_LABELS[c]).join(" · ")}</p>}
      </Section>
      <Section title="Pix" icon={<KeyRound />} lines={[{ label: sub?.pixKey ? `Chave · ${pixLabel[sub.pixType]}` : "Chave Pix", value: sensitive(sub?.pixKey), concealed: !revealed }]} />
    </div>
    <Section title="Endereço" icon={<MapPin />} empty={subQ.isPending ? "Carregando endereço…" : subQ.isError ? "Cadastro indisponível." : "Endereço não informado."} lines={sub ? [
      { label: "CEP", value: sub.postalCode ? formatBrazilianPostalCode(sub.postalCode) : null },
      { label: "Logradouro", value: [sub.street, sub.number].filter(Boolean).join(", ") || null },
      { label: "Complemento", value: sub.complement },
      { label: "Bairro", value: sub.district },
      { label: "Cidade/UF", value: [sub.city, sub.state].filter(Boolean).join("/") || null },
    ] : []} />
    <Section title="Proponentes" meta={people.length ? `${people.length} ${people.length === 1 ? "pessoa" : "pessoas"}` : undefined} icon={<Users />}>
      {!people.length ? <p className="text-sm text-[var(--stayo-ink-muted)]">{subQ.isPending ? "Carregando proponentes…" : subQ.isError ? "Cadastro indisponível." : "Nenhum proponente informado."}</p> : people.map((p, i) => <article key={i} className="min-w-0 border-b border-[var(--stayo-border)] py-3 first:pt-0 last:border-0 last:pb-0">
        <div className="mb-2 flex items-start gap-2"><UserRound className="mt-0.5 size-4 shrink-0 text-[var(--stayo-ink-muted)]" /><div className="min-w-0 flex-1"><h4 className="break-words text-sm font-semibold">{p.fullName || `Proponente ${i + 1}`}</h4><p className="text-xs text-[var(--stayo-ink-muted)]">{roleLabel[p.role]}</p></div></div>
        <Fields lines={[{ label: "WhatsApp", value: phone(p.phone) }, { label: "E-mail", value: p.email }]} />
        <Button variant="ghost" size="sm" aria-expanded={expanded.includes(i)} aria-controls={`person-details-${i}`} className="mt-1 px-0 text-[var(--stayo-ink-muted)]" onClick={() => setExpanded(current => current.includes(i) ? current.filter(n => n !== i) : [...current, i])}>Dados pessoais<ChevronDown className={expanded.includes(i) ? "rotate-180" : ""} /></Button>
        {expanded.includes(i) && <div id={`person-details-${i}`} className="mt-2"><Fields lines={[{ label: "CPF/CNPJ", value: doc(p.document), concealed: !revealed }, { label: "Estado civil", value: p.maritalStatus ? maritalLabel[p.maritalStatus] ?? p.maritalStatus : null }, { label: "Profissão", value: p.profession }]} /></div>}
      </article>)}
    </Section>
    <Section icon={<Building2 />} title="Imóvel" meta={property || undefined}>
      {detailsQ.isError && <p role="alert" className="mb-2 text-sm text-destructive">Não foi possível carregar os detalhes do imóvel. <Button variant="link" size="sm" onClick={() => void detailsQ.refetch()}>Tentar novamente</Button></p>}
      <Fields lines={[
        { label: "Condomínio", value: implementation.condominiumName }, { label: "Unidade", value: implementation.unit },
        { label: "Quartos", value: num(implementation.bedrooms ?? details?.bedrooms) }, { label: "Suítes", value: num(details?.suites) },
        { label: "Banheiros", value: num(details?.bathrooms) }, { label: "Lavabos", value: num(details?.lavatories) },
        { label: "Estacionamento", value: [details?.parkingBox && `Box ${details.parkingBox}`, details?.parkingSpots != null && `${details.parkingSpots} ${details.parkingSpots === 1 ? "vaga" : "vagas"}`].filter(Boolean).join(" · ") || null, wide: true },
      ]} />
    </Section>
    <Section icon={<Landmark />} title="Dados bancários" meta="Recebimento dos repasses" empty={subQ.isPending ? "Carregando dados bancários…" : subQ.isError ? "Cadastro indisponível." : "Dados bancários não informados."} lines={sub ? [
      { label: "Banco", value: sub.bankName }, { label: "Tipo de conta", value: sub.accountNumber ? accountLabel[sub.accountType] : null },
      { label: "Agência", value: sensitive(sub.bankBranch), concealed: !revealed }, { label: "Conta", value: sensitive(sub.accountNumber), concealed: !revealed },
      { label: "Titular", value: sub.accountHolder }, { label: "CPF/CNPJ do titular", value: doc(sub.holderTaxId), concealed: !revealed },
    ] : []} />
  </div>;
}
