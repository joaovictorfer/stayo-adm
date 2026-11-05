import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SourceBadge, DivergenceBox } from "./SourceBadge";
import { divergenceSnapshot, resolveField, type NormalizeKind, type ResolvedField } from "../../../lib/field-sources";
import { fieldDecisionsQuery, saveFieldDecision } from "../../../lib/api/field-decisions";
import { Building2, Check, ChevronDown, Copy, Eye, EyeOff, Globe, KeyRound, Landmark, MapPin, Pencil, UserRound, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { ownerOnboardingSubmissionQuery } from "../../../lib/api/queries";
import { getImplementationPlatforms, CHANNEL_LABELS } from "../../../lib/api/owner-platforms";
import { getPropertyDetails } from "../../../lib/api/owner-portal-data";
import { formatBrazilianDocument, formatBrazilianPhone, formatBrazilianPostalCode, maskDocument, maskPixKey } from "../../../lib/owner-form-validation";
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
export type OfficialKey = "name" | "phone" | "email" | "document";
export type OfficialOwner = { name?: string | null; phone?: string | null; email?: string | null; document?: string | null } | null | undefined;

export function OwnerRegistrationSheet({ implementation, onEditOwner, official, note, onAcceptSubmitted }: {
  implementation: ImplementationProject; onEditOwner?: (() => void) | undefined;
  official?: OfficialOwner; note?: string | null | undefined;
  onAcceptSubmitted?: ((key: OfficialKey, value: string) => Promise<void>) | undefined;
}) {
  const qc = useQueryClient();
  const decisionsQ = useQuery(fieldDecisionsQuery(implementation.id));
  const [busy, setBusy] = useState(false);
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
    <Section title="Pessoas do contrato" meta={people.length ? `${people.length} ${people.length === 1 ? "pessoa" : "pessoas"} · titular primeiro` : undefined} icon={<Users />}>
      {(() => {
        const list = people.length ? people : official?.name ? [{ fullName: "", document: "", email: "", phone: "", role: "proprietario" as const, maritalStatus: null, profession: null }] : [];
        if (!list.length) return <p className="text-sm text-[var(--stayo-ink-muted)]">{subQ.isPending ? "Carregando…" : subQ.isError ? "Cadastro indisponível." : "Nenhuma pessoa informada."}</p>;
        const decisions = decisionsQ.data ?? {};
        const decide = async (key: string, decision: "usar_oficial" | "conferir_local", f: ResolvedField) => {
          if (!f.divergence) return;
          setBusy(true);
          try { await saveFieldDecision(implementation.id, key, decision, divergenceSnapshot(f.divergence.official, f.divergence.submitted)); await qc.invalidateQueries({ queryKey: ["field-decisions", implementation.id] }); toast.success(decision === "usar_oficial" ? "Mantido o valor oficial" : "Marcado para conferir no local"); }
          catch { toast.error("Não foi possível registrar a decisão."); } finally { setBusy(false); }
        };
        return list.map((p, i) => {
          const titular = i === 0;
          const show = (k: OfficialKey, v: string) => k === "document" ? doc(v) ?? v : k === "phone" ? phone(v) ?? v : v;
          const fields: Array<{ key: string; label: string; f: ResolvedField; officialKey?: OfficialKey; concealed?: boolean }> = [];
          const add = (label: string, key: string, off: string | null | undefined, sub: string | null | undefined, kind: NormalizeKind, officialKey?: OfficialKey) =>
            fields.push({ key: `p${i}:${key}`, label, f: resolveField(off, sub, kind, decisions[`p${i}:${key}`]), ...(officialKey ? { officialKey } : {}), ...(key === "document" ? { concealed: !revealed } : {}) });
          add("Nome", "name", titular ? official?.name : null, p.fullName, "text", titular ? "name" : undefined);
          add("CPF/CNPJ", "document", titular ? official?.document : null, p.document, "digits", titular ? "document" : undefined);
          add("WhatsApp", "phone", titular ? official?.phone : null, p.phone, "digits", titular ? "phone" : undefined);
          add("E-mail", "email", titular ? official?.email : null, p.email, "email", titular ? "email" : undefined);
          add("Estado civil", "marital", null, p.maritalStatus ? maritalLabel[p.maritalStatus] ?? p.maritalStatus : null, "text");
          add("Profissão", "profession", null, p.profession, "text");
          const missing = fields.filter((x) => x.f.missing).map((x) => x.label);
          const display = fields.find((x) => x.key.endsWith(":name"))?.f.value || `Pessoa ${i + 1}`;
          return <article key={i} className="min-w-0 border-b border-[var(--stayo-border)] py-3 first:pt-0 last:border-0 last:pb-0" data-testid="contract-person">
            <div className="mb-2 flex items-start gap-2"><UserRound className="mt-0.5 size-4 shrink-0 text-[var(--stayo-ink-muted)]" /><div className="min-w-0 flex-1"><h4 className="break-words text-sm font-semibold">{display}</h4><p className="text-xs text-[var(--stayo-ink-muted)]">{titular ? "Titular" : roleLabel[p.role]}</p></div></div>
            <dl className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
              {fields.filter((x) => !x.f.missing).map((x) => x.f.divergence && x.officialKey ? <DivergenceBox key={x.key} label={x.label} busy={busy}
                  official={x.concealed ? show(x.officialKey, x.f.divergence.official) : show(x.officialKey, x.f.divergence.official)} submitted={show(x.officialKey, x.f.divergence.submitted)} checking={x.f.divergence.checking}
                  onOfficial={() => void decide(x.key, "usar_oficial", x.f)} onCheck={() => void decide(x.key, "conferir_local", x.f)}
                  onSubmitted={async () => { if (!onAcceptSubmitted) return; setBusy(true); try { await onAcceptSubmitted(x.officialKey!, x.f.divergence!.submitted); toast.success("Valor enviado aceito como oficial"); } catch (e) { toast.error((e as Error).message || "Não foi possível aceitar."); } finally { setBusy(false); } }} />
                : <div key={x.key} className="min-w-0"><dt className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--stayo-ink-muted)]">{x.label}{x.f.badge && <SourceBadge kind={x.f.badge} />}</dt>
                  <dd className="mt-0.5 break-words text-sm font-medium text-[var(--stayo-navy)]">{x.officialKey ? show(x.officialKey, x.f.value!) : x.key.endsWith(":document") ? doc(x.f.value) : x.f.value}</dd></div>)}
              {titular && note && <div className="col-span-full min-w-0"><dt className="flex items-center gap-1.5 text-xs text-[var(--stayo-ink-muted)]">Observação<SourceBadge kind="nota" /></dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--stayo-navy)]">{note}</dd></div>}
            </dl>
            {missing.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-[var(--ficha-subtle)] px-3 py-2 text-xs">
              <span className="text-[var(--stayo-ink-muted)]">Falta:</span><span className="font-medium">{missing.join(", ")}</span>
              <Button variant="link" size="sm" className="h-auto px-0" onClick={() => void copy(`Olá! Para concluir o contrato, falta informar ${titular ? "" : `de ${display} `}: ${missing.join(", ")}.`, "Pedido copiado")}>Copiar pedido</Button>
            </div>}
          </article>;
        });
      })()}
    </Section>
    <Section icon={<Building2 />} title="Imóvel" meta={[property, "editado só na aba Imóvel"].filter(Boolean).join(" · ")}>
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
