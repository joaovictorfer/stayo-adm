import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, ChevronRight, Eye, EyeOff, FileText, Home, LockKeyhole, Pencil, Plus, Users } from "lucide-react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Collapsible } from "./FichaParts";
import { OwnerRegistrationSheet, Section } from "./OwnerRegistrationSheet";
import { adminApi, implementationsListQuery, ownerNoteQuery, ownerOnboardingSubmissionQuery, ownerQuery, propertiesListQuery } from "../../../lib/api/queries";
import { ownerNotesStore } from "../../../lib/api/local-store";
import { formatBrazilianDocument, formatBrazilianPhone, maskDocument, normalizeDocument, ownerAdminEditSchema } from "../../../lib/owner-form-validation";
import { statusLabels } from "../../../lib/implementation-status";
import { contractStageLabel, currentContractStage } from "../../../lib/journey-states";
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

export function FichaProprietario({ implementation, portal, review, pending, proposal, journey, onGo }: {
  implementation: ImplementationProject;
  portal: ReactNode;
  review: ReactNode;
  pending: PendingEntry[];
  proposal: CommercialProposalVersion | null;
  journey: string;
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
  const otherImplementations = (links.data?.data ?? []).filter(item => item.ownerId === implementation.ownerId && item.id !== implementation.id);
  const ownerProperties = (properties.data?.data ?? []).filter(item => owner?.coreOwnerId && item.ownerId === owner.coreOwnerId);
  const propertyName = implementation.nickname || [implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ") || implementation.code;
  const openEdit = () => {
    setForm({ name: owner?.name ?? "", phone: owner?.phone ?? "", email: owner?.email ?? "", document: owner?.document ?? "" });
    setErrors({}); save.reset(); setEditing(true);
  };

  return <div className="space-y-4 text-[var(--stayo-navy)]">
    {ownerQueryResult.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o cadastro. <Button variant="link" size="sm" onClick={() => void ownerQueryResult.refetch()}>Tentar novamente</Button></p>}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
      <div className="min-w-0 space-y-2.5">
        <OwnerRegistrationSheet implementation={implementation} onEditOwner={owner ? openEdit : undefined} official={owner} note={note.data?.content}
          onAcceptSubmitted={owner ? async (key, value) => {
            const next = { name: owner.name ?? "", phone: owner.phone ?? "", email: owner.email ?? "", document: owner.document ?? "", [key]: value };
            const parsed = ownerAdminEditSchema.safeParse(next);
            if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Valor enviado inválido.");
            await adminApi.owners.update(owner.id, parsed.data);
            await Promise.all([queryClient.invalidateQueries({ queryKey: ["owners"] }), queryClient.invalidateQueries({ queryKey: ["implementations"] })]);
          } : undefined} />
        <Section title="Outros vínculos" icon={<Home />} status={{ tone: "neutral", text: String((implementation.ownerId ? 1 : 0) + otherImplementations.length) }}>
          {links.isError || properties.isError ? <p className="text-sm text-destructive">Não foi possível carregar os vínculos.</p> : <>
            <div className="flex flex-wrap items-center gap-2 text-sm"><Home className="size-4" /><span className="flex-1">Imóveis vinculados</span><span className="text-[var(--stayo-ink-muted)]">{links.isPending && owner ? "Carregando…" : (n => `${n} ${n === 1 ? "vínculo" : "vínculos"}`)((implementation.ownerId ? 1 : 0) + otherImplementations.length + ownerProperties.filter(property => ![implementation, ...otherImplementations].some(item => item.corePropertyId === property.id)).length)}</span>
            {implementation.ownerId && <Button asChild variant="link" size="sm" className="px-0"><Link to="/proprietarios/$id" params={{ id: implementation.ownerId }}>Ver vínculos <ChevronRight /></Link></Button>}</div>
            {implementation.ownerId && <div className={`${row} text-sm`}><span className="min-w-0 flex-1 break-words font-medium">{implementation.nickname || [implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ") || implementation.code}</span><span className="text-xs text-[var(--stayo-ink-muted)]">Esta ficha · {statusLabels[implementation.status]}</span></div>}
            {otherImplementations.map(item => <Link key={item.id} to="/implantacao/$id" params={{ id: item.id }} className={`${row} text-sm`}><span className="min-w-0 flex-1 break-words">{item.nickname || [item.condominiumName, item.unit].filter(Boolean).join(" · ") || item.code}</span><span className="text-xs text-[var(--stayo-ink-muted)]">{statusLabels[item.status]}</span><ChevronRight className="size-4 shrink-0" /></Link>)}
            {ownerProperties.filter(property => ![implementation, ...otherImplementations].some(item => item.corePropertyId === property.id)).map(property => <Link key={property.id} to="/imoveis/$id" params={{ id: property.id }} className={`${row} text-sm`}><span className="min-w-0 flex-1 break-words">{property.name}</span><ChevronRight className="size-4 shrink-0" /></Link>)}
          </>}
        </Section>
        <Section title="Observações internas" meta="Visível somente para a equipe STAYO" icon={<FileText />} status={{ tone: "neutral", text: note.data?.content ? "1" : "0" }}>
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--stayo-ink-muted)]">{note.isError ? "Não foi possível carregar as observações." : note.data?.content || "Nenhuma observação interna."}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1 text-xs text-[var(--stayo-ink-muted)]"><LockKeyhole className="size-3" />Não aparece no Portal.</p><Button variant="outline" size="sm" disabled={!implementation.ownerId || note.isPending || note.isError} onClick={() => { setNoteDraft(note.data?.content ?? ""); saveNote.reset(); setEditingNote(true); }}>{note.data?.content ? <Pencil /> : <Plus />}{note.data?.content ? "Editar observação" : "Adicionar observação"}</Button></div>
        </Section>
      </div>
      <aside className="min-w-0 space-y-3" aria-label="Relacionamento do proprietário">
        {portal}
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
