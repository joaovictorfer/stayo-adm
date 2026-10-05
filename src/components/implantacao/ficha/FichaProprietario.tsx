import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, ChevronRight, Eye, EyeOff, FileText, Home, LockKeyhole, Mail, Pencil, Phone, Plus, Users } from "lucide-react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Collapsible } from "./FichaParts";
import { adminApi, implementationsListQuery, ownerNoteQuery, ownerOnboardingSubmissionQuery, ownerQuery, propertiesListQuery } from "../../../lib/api/queries";
import { ownerNotesStore } from "../../../lib/api/local-store";
import { formatBrazilianDocument, formatBrazilianPhone, maskDocument, normalizeDocument, ownerAdminEditSchema } from "../../../lib/owner-form-validation";
import { statusLabels } from "../../../lib/implementation-status";
import { proposalStatusLabel, type FichaSection } from "../../../lib/ficha-next-action";
import type { PendingEntry } from "./FichaSummary";
import type { ImplementationProject } from "../../../types/core";
import type { CommercialProposalVersion } from "../../../types/commercial-proposal";

const panel = "min-w-0 rounded-lg border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-4 py-3";
const heading = "font-[Outfit] text-base font-semibold text-[var(--stayo-navy)]";
const row = "flex min-h-10 w-full items-center justify-between gap-3 border-b border-[var(--stayo-border)] py-2 last:border-b-0";

function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return <h3 className={`${heading} mb-2 flex items-center gap-2`}>{icon && <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ficha-icon-bg)] text-[var(--ficha-icon-fg)] [&_svg]:size-4">{icon}</span>}{children}</h3>;
}

export function FichaProprietario({ implementation, portal, review, pending, proposal, hasConditions, onGo }: {
  implementation: ImplementationProject;
  portal: ReactNode;
  review: ReactNode;
  pending: PendingEntry[];
  proposal: CommercialProposalVersion | null;
  hasConditions: boolean;
  onGo: (section: FichaSection) => void;
}) {
  const queryClient = useQueryClient();
  const ownerQueryResult = useQuery({ ...ownerQuery(implementation.ownerId ?? ""), enabled: Boolean(implementation.ownerId) });
  const submissionQuery = useQuery(ownerOnboardingSubmissionQuery(implementation.id));
  const owner = ownerQueryResult.data;
  const submission = submissionQuery.data;
  const links = useQuery({ ...implementationsListQuery(), enabled: Boolean(owner) });
  const properties = useQuery({ ...propertiesListQuery(), enabled: Boolean(owner?.coreOwnerId) });
  const note = useQuery({ ...ownerNoteQuery(implementation.ownerId ?? ""), enabled: Boolean(implementation.ownerId) });
  const [editing, setEditing] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", document: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setForm({ name: owner?.name ?? "", phone: owner?.phone ?? "", email: owner?.email ?? "", document: owner?.document ?? "" });
  }, [owner]);
  useEffect(() => { setNoteDraft(note.data?.content ?? ""); }, [note.data]);
  const save = useMutation({
    mutationFn: async () => {
      if (!owner) throw new Error("Aguarde o carregamento do proprietário.");
      const result = ownerAdminEditSchema.safeParse(form);
      if (!result.success) {
        setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
        throw new Error("Confira os campos destacados.");
      }
      setErrors({});
      return adminApi.owners.update(owner.id, result.data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owners"] }),
        queryClient.invalidateQueries({ queryKey: ["implementations"] }),
      ]);
      setEditing(false);
    },
  });
  const saveNote = useMutation({
    mutationFn: async () => {
      if (!implementation.ownerId) throw new Error("Vincule um proprietário para adicionar notas.");
      return ownerNotesStore.save(implementation.ownerId, noteDraft);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owner-notes", implementation.ownerId] });
      setEditingNote(false);
    },
  });
  const name = owner?.name || implementation.ownerName || "Proprietário não informado";
  const document = owner?.document ?? "";
  const phone = owner?.phone || implementation.ownerPhone;
  const email = owner?.email;
  const maskedEmail = email ? email.replace(/^(.{1,3})[^@]*(@.*)$/, "$1•••$2") : "Não informado";
  const personType = normalizeDocument(document).length === 14 ? "Pessoa jurídica" : normalizeDocument(document).length === 11 ? "Pessoa física" : "Não informado";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const additionalPeople = submission?.people.filter(person => person.role !== "proprietario") ?? [];
  const otherImplementations = (links.data?.data ?? []).filter(item => item.ownerId === implementation.ownerId && item.id !== implementation.id);
  const ownerProperties = (properties.data?.data ?? []).filter(item => owner?.coreOwnerId && item.ownerId === owner.coreOwnerId);
  const propertyName = implementation.nickname || [implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ") || implementation.code;
  const openEdit = () => {
    setForm({ name: owner?.name ?? "", phone: owner?.phone ?? "", email: owner?.email ?? "", document: owner?.document ?? "" });
    setErrors({}); save.reset(); setEditing(true);
  };

  return <div className="space-y-4 text-[var(--stayo-navy)]">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="font-[Outfit] text-2xl font-semibold">Proprietário</h2>
      <Button size="sm" variant="outline" disabled={!owner} onClick={openEdit}><Pencil /> Editar dados</Button>
    </header>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <div className="min-w-0 space-y-3">
        <section className={panel} aria-label="Dados principais">
          <SectionTitle>Dados principais</SectionTitle>
          {ownerQueryResult.isError && <p role="alert" className="mb-3 text-sm text-destructive">Não foi possível carregar o cadastro. <Button variant="link" size="sm" onClick={() => void ownerQueryResult.refetch()}>Tentar novamente</Button></p>}
          <div className="mb-1 flex items-center gap-3 py-2">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--ficha-icon-bg)] font-semibold text-[var(--ficha-icon-fg)]">{initials}</span>
            <div className="min-w-0"><p className="break-words font-semibold">{name}</p><p className="text-xs text-[var(--stayo-ink-muted)]">{implementation.ownerId ? "Proprietário principal" : "Sem vínculo cadastral"}</p></div>
          </div>
          {[
            { label: "WhatsApp", value: phone ? formatBrazilianPhone(phone) : "Não informado", icon: <Phone /> },
            { label: "E-mail", value: showSensitive ? email || "Não informado" : maskedEmail, icon: <Mail /> },
            { label: "Tipo", value: personType, icon: <Users /> },
          ].map(item => <Button key={item.label} variant="ghost" className={`${row} h-auto rounded-none px-0 text-left text-sm font-normal whitespace-normal`} disabled={!owner} onClick={openEdit}>
            <span className="w-24 shrink-0">{item.label}</span><span className="min-w-0 flex-1 break-words font-medium">{item.value}</span><ChevronRight className="size-4 shrink-0" />
          </Button>)}
          <div className={`${row} border-t`}>
            <span className="w-24 shrink-0 text-sm">CPF/CNPJ</span><span className="min-w-0 flex-1 break-words text-sm font-medium">{showSensitive ? formatBrazilianDocument(document) || "Não informado" : maskDocument(document)}</span>
            <Button variant="ghost" size="icon" className="size-8" disabled={!document && !email} aria-label={showSensitive ? "Ocultar dados sensíveis" : "Mostrar dados sensíveis"} title={showSensitive ? "Ocultar dados sensíveis" : "Mostrar dados sensíveis"} onClick={() => setShowSensitive(value => !value)}>{showSensitive ? <EyeOff /> : <Eye />}</Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Editar CPF ou CNPJ" title="Editar CPF ou CNPJ" disabled={!owner} onClick={openEdit}><ChevronRight /></Button>
          </div>
        </section>
        <section className={panel} aria-label="Vínculo com o imóvel">
          <SectionTitle>Vínculo com o imóvel</SectionTitle>
          <Button variant="ghost" className="h-auto min-h-12 w-full justify-start rounded-none px-0 text-left whitespace-normal" onClick={() => onGo("imovel")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--ficha-icon-bg)] text-[var(--ficha-icon-fg)]"><Building2 /></span>
            <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{propertyName}</span><span className="text-xs font-normal text-[var(--stayo-ink-muted)]">{implementation.ownerId ? "Proprietário principal" : "Sem proprietário vinculado"}</span></span><span className="hidden text-xs sm:inline">Ver imóvel</span><ChevronRight />
          </Button>
          <div className={row}><span className="text-sm">Participação</span><span className="text-right text-sm font-medium">{implementation.ownerId ? "Proprietário principal" : "Não informado"}</span></div>
          {additionalPeople.map((person, index) => <div key={`${person.document}-${index}`} className={row}><span className="min-w-0"><span className="block break-words text-sm font-medium">{person.fullName}</span><span className="text-xs text-[var(--stayo-ink-muted)]">{person.role === "coproprietario" ? "Coproprietário" : "Proponente"} · {submission?.submittedAt ? "Cadastro recebido" : "Cadastro em andamento"}</span></span><span className="shrink-0 text-xs">{showSensitive ? formatBrazilianDocument(person.document) : maskDocument(person.document)}</span></div>)}
          {additionalPeople.length === 0 && <p className="pt-2 text-xs text-[var(--stayo-ink-muted)]">Nenhum coproprietário ou representante informado.</p>}
        </section>
        <section className={panel} aria-label="Outros vínculos">
          <SectionTitle>Outros vínculos</SectionTitle>
          {links.isError || properties.isError ? <p className="text-sm text-destructive">Não foi possível carregar os vínculos.</p> : <>
            <div className="flex flex-wrap items-center gap-2 text-sm"><Home className="size-4" /><span className="flex-1">Imóveis vinculados</span><span className="text-[var(--stayo-ink-muted)]">{links.isPending && owner ? "Carregando…" : `${(implementation.ownerId ? 1 : 0) + otherImplementations.length + ownerProperties.filter(property => ![implementation, ...otherImplementations].some(item => item.corePropertyId === property.id)).length} vínculo(s)`}</span>
            {implementation.ownerId && <Button asChild variant="link" size="sm" className="px-0"><Link to="/proprietarios/$id" params={{ id: implementation.ownerId }}>Ver vínculos <ChevronRight /></Link></Button>}</div>
            {otherImplementations.map(item => <Link key={item.id} to="/implantacao/$id" params={{ id: item.id }} className={`${row} text-sm`}><span className="min-w-0 flex-1 break-words">{item.nickname || [item.condominiumName, item.unit].filter(Boolean).join(" · ") || item.code}</span><span className="text-xs text-[var(--stayo-ink-muted)]">{statusLabels[item.status]}</span><ChevronRight className="size-4 shrink-0" /></Link>)}
            {ownerProperties.filter(property => ![implementation, ...otherImplementations].some(item => item.corePropertyId === property.id)).map(property => <Link key={property.id} to="/imoveis/$id" params={{ id: property.id }} className={`${row} text-sm`}><span className="min-w-0 flex-1 break-words">{property.name}</span><ChevronRight className="size-4 shrink-0" /></Link>)}
          </>}
        </section>
        <section className={panel} aria-label="Observações internas">
          <div className="flex flex-wrap items-center justify-between gap-2"><SectionTitle icon={<FileText />}>Observações internas</SectionTitle><Button variant="outline" size="sm" disabled={!implementation.ownerId || note.isPending || note.isError} onClick={() => { setNoteDraft(note.data?.content ?? ""); saveNote.reset(); setEditingNote(true); }}>{note.data?.content ? <Pencil /> : <Plus />}{note.data?.content ? "Editar observação" : "Adicionar observação"}</Button></div>
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--stayo-ink-muted)]">{note.isError ? "Não foi possível carregar as observações." : note.data?.content || "Nenhuma observação interna."}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--stayo-ink-muted)]"><LockKeyhole className="size-3" />Visível somente para a equipe STAYO.</p>
        </section>
        <Collapsible title="Cadastro do proprietário" summary={submission?.submittedAt ? "Cadastro recebido · revisar informações" : submission ? "Cadastro em andamento" : "Link e revisão de dados cadastrais"}>{review}</Collapsible>
      </div>
      <aside className="min-w-0 space-y-3" aria-label="Relacionamento do proprietário">
        {portal}
        <section className={panel}>
          <SectionTitle icon={<AlertCircle />}>Pendências</SectionTitle>
          {pending.length ? pending.map(entry => <Button key={entry.id} variant="ghost" className={`${row} h-auto rounded-none px-0 text-left text-sm font-normal whitespace-normal`} onClick={() => onGo(entry.section)}><span className="min-w-0 flex-1"><span className="block">{entry.title}</span><span className="block text-xs text-[var(--stayo-ink-muted)]">{entry.detail}</span></span><span className="shrink-0 rounded-full bg-[var(--ficha-pending-bg)] px-2 py-1 text-[10px] text-[var(--ficha-pending-fg)]">{entry.chip}</span><ChevronRight /></Button>) : <p className="text-sm text-[var(--stayo-ink-muted)]">Nenhuma pendência identificada.</p>}
          <Button variant="link" size="sm" className="px-0" onClick={() => onGo("visao")}>Ver resumo <ChevronRight /></Button>
        </section>
        <section className={panel}>
          <SectionTitle icon={<Users />}>Relacionamento</SectionTitle>
          {[
            { label: "Implantação", value: statusLabels[implementation.status], section: "implantacao" as const },
            { label: "Proposta", value: proposal ? `v${proposal.version} · ${proposalStatusLabel[proposal.status]}` : "Não criada", section: "proposta" as const },
            { label: "Contrato", value: hasConditions ? "Condições registradas" : "Condições não definidas", section: "contrato" as const },
          ].map(item => <Button key={item.label} variant="ghost" className={`${row} h-auto rounded-none px-0 text-left text-sm font-normal whitespace-normal`} onClick={() => onGo(item.section)}><span>{item.label}</span><span className="min-w-0 flex-1 text-right text-xs text-[var(--stayo-ink-muted)]">{item.value}</span><ChevronRight /></Button>)}
        </section>
      </aside>
    </div>
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader><DialogTitle>Editar dados do proprietário</DialogTitle><DialogDescription>Este cadastro é compartilhado pelos imóveis vinculados ao proprietário.</DialogDescription></DialogHeader>
        {([{ key: "name", label: "Nome", type: "text" }, { key: "phone", label: "WhatsApp", type: "tel" }, { key: "email", label: "E-mail", type: "email" }, { key: "document", label: "CPF/CNPJ", type: "text" }] as const).map(field => <label key={field.key} className="space-y-1 text-sm"><span>{field.label}</span><Input type={field.type} value={field.key === "phone" ? formatBrazilianPhone(form.phone) : field.key === "document" ? formatBrazilianDocument(form.document) : form[field.key]} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} aria-invalid={Boolean(errors[field.key])} />{errors[field.key] && <span role="alert" className="block text-xs text-destructive">{errors[field.key]}</span>}</label>)}
        {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>Cancelar</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar dados"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={editingNote} onOpenChange={setEditingNote}><DialogContent className="w-[calc(100%-2rem)] rounded-lg"><DialogHeader><DialogTitle>Observação interna</DialogTitle><DialogDescription>Visível somente para a equipe STAYO. Não aparece no Portal.</DialogDescription></DialogHeader><Textarea aria-label="Observação interna" value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows={5} />{saveNote.isError && <p role="alert" className="text-sm text-destructive">{saveNote.error.message}</p>}<DialogFooter><Button variant="outline" onClick={() => setEditingNote(false)}>Cancelar</Button><Button disabled={saveNote.isPending} onClick={() => saveNote.mutate()}>{saveNote.isPending ? "Salvando…" : "Salvar observação"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
