import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Building2, CheckCircle2, Clock3, Copy, ExternalLink, FileText,
  Home, Mail, MessageCircle, MoreHorizontal, Pencil, ShieldCheck, UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { listOwnerAttachments, isAttachmentsAvailable } from "../../lib/api/attachments";
import { ownerNotesStore } from "../../lib/api/local-store";
import {
  adminApi, contractsListQuery, implementationItemsQuery, implementationOwnersQuery,
  implementationsListQuery, ownerAdministrativeRegistrationQuery, ownerNoteQuery,
  ownerOnboardingLinkQuery, ownerTasksQuery, payoutsListQuery, propertiesListQuery,
  reservationsListQuery, serviceInvoicesListQuery,
} from "../../lib/api/queries";
import { useAuthSession } from "../../lib/auth/session";
import { formatMoney } from "../../lib/format";
import { statusLabels } from "../../lib/implementation-status";
import {
  deriveOwnerWorkspaceStatus, maskPixKey, ownerRegistrationStatus, pendingOwnerTasks,
} from "../../lib/owner-workspace";
import type { OwnerRecord } from "../../types/admin";
import type {
  Contract, ImplementationProject, Property, Reservation, ServiceInvoice,
  Payout,
} from "../../types/core";
import type { OwnerAdministrativeRegistration, OwnerOnboardingLink } from "../../types/owner-onboarding";
import { ownerOnboardingLinkStatus } from "../../types/owner-onboarding";
import { ErrorRows, Panel } from "../data/ListStates";
import { OwnerPortalAccess } from "../implantacao/OwnerPortalAccess";
import { Timeline, type TimelineEntry } from "../patterns/Timeline";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const tokenKey = (id: string) => `stayo-admin:portal-token:${id}`;
const pixLabels = { cpf: "CPF", cnpj: "CNPJ", phone: "Telefone", email: "E-mail", random: "Chave aleatória" };
type WorkspaceTab = "resumo" | "imoveis" | "implantacoes" | "contratos" | "financeiro" | "documentos" | "portal" | "historico";

export function OwnerWorkspace({ owner }: { owner: OwnerRecord }) {
  const auth = useAuthSession();
  const [tab, setTab] = useState<WorkspaceTab>("resumo");
  const [editing, setEditing] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const propertiesQ = useQuery(propertiesListQuery());
  const implementationsQ = useQuery(implementationsListQuery());
  const contractsQ = useQuery(contractsListQuery());
  const payoutsQ = useQuery(payoutsListQuery());
  const invoicesQ = useQuery(serviceInvoicesListQuery());
  const reservationsQ = useQuery(reservationsListQuery());
  const tasksQ = useQuery(ownerTasksQuery(owner.id));
  const allImplementations = implementationsQ.data?.data ?? [];
  const relationQueries = useQueries({ queries: allImplementations.map((item) => implementationOwnersQuery(item.id)) });
  const implementations = allImplementations.filter((item, index) =>
    item.ownerId === owner.id || (relationQueries[index]?.data ?? []).some((link) => link.ownerId === owner.id),
  );
  const implementationIds = implementations.map((item) => item.id);
  const properties = (propertiesQ.data?.data ?? []).filter((item) => item.ownerId === owner.id);
  const contracts = (contractsQ.data?.data ?? []).filter((item) => item.ownerId === owner.id);
  const payouts = (payoutsQ.data?.data ?? []).filter((item) => item.ownerId === owner.id);
  const invoices = (invoicesQ.data?.data ?? []).filter((item) => item.ownerId === owner.id);
  const propertyIds = new Set(properties.map((item) => item.id));
  const reservations = (reservationsQ.data?.data ?? []).filter((item) => propertyIds.has(item.propertyId));
  const tasks = tasksQ.data ?? [];
  const pending = pendingOwnerTasks(tasks);

  const role = auth.profile?.role;
  const canSeeBanking = auth.status === "not_required" || role === "super_admin" || role === "admin" || role === "finance";
  const canSeeDocuments = auth.status === "not_required" || role === "super_admin" || role === "admin" || role === "commercial" || role === "operations";
  const registrationQ = useQuery({
    ...ownerAdministrativeRegistrationQuery(owner.id, implementationIds),
    enabled: canSeeBanking && implementationIds.length > 0,
  });
  const attachmentsQ = useQuery({
    queryKey: ["owner-attachments", owner.id],
    queryFn: () => listOwnerAttachments(owner.id),
    enabled: canSeeDocuments && isAttachmentsAvailable(),
  });
  const portalQueries = useQueries({ queries: implementations.map((item) => ownerOnboardingLinkQuery(item.id)) });
  const links = portalQueries.map((query) => query.data ?? null);
  const activePortalIndex = links.findIndex((link) => link && ownerOnboardingLinkStatus(link) === "ativo");
  const portalImplementation = implementations[activePortalIndex] ?? implementations[0] ?? null;
  const checklistQ = useQuery({
    ...implementationItemsQuery(portalImplementation?.id ?? ""),
    enabled: Boolean(portalImplementation),
  });
  const hasActivePortal = activePortalIndex >= 0;
  const hasDocuments = (attachmentsQ.data?.length ?? 0) > 0;
  const registration = ownerRegistrationStatus({
    hasSubmittedProfile: Boolean(registrationQ.data?.submittedAt || owner.document),
    hasPayoutAccount: Boolean(registrationQ.data?.pixKey),
    hasDocuments,
    hasContract: contracts.some((item) => Boolean(item.signedAt)),
  });
  const status = deriveOwnerWorkspaceStatus(owner, properties, implementations);
  const timeline = useMemo(
    () => buildTimeline({ contracts, invoices, reservations, implementations }),
    [contracts, invoices, reservations, implementations],
  );

  const openPortal = () => {
    if (!portalImplementation) return;
    const token = window.sessionStorage.getItem(tokenKey(portalImplementation.id));
    if (token) window.open(`/portal/implantacao/${token}`, "_blank", "noopener,noreferrer");
    else setPortalOpen(true);
  };

  return (
    <div className="min-w-0 space-y-4">
      <header className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link to="/proprietarios" className="text-xs font-semibold text-muted-foreground hover:text-foreground">← Proprietários</Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-foreground">{owner.name}</h1>
              <StatusPill status={status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Proprietário</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openPortal} disabled={!portalImplementation}><ExternalLink /> Abrir portal</Button>
            <Button variant="outline" onClick={() => { setTab("resumo"); setEditing(true); }}><Pencil /> Editar</Button>
            <Button
              variant="outline"
              disabled={!owner.phone && !owner.email}
              onClick={() => {
                if (owner.phone) window.open(`https://wa.me/55${owner.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer");
                else if (owner.email) window.location.href = `mailto:${owner.email}`;
              }}
            ><MessageCircle /> Enviar mensagem</Button>
            <div className="relative">
              <Button variant="ghost" size="icon" aria-label="Mais ações" onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal /></Button>
              {moreOpen ? <div className="absolute right-0 top-10 z-20 w-48 rounded-md border border-border bg-card p-1 shadow-lg"><button type="button" className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { void navigator.clipboard.writeText(owner.name); setMoreOpen(false); }}><Copy className="mr-2 inline h-4 w-4" />Copiar nome</button></div> : null}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Metric icon={Home} label="Imóveis" value={properties.length} />
          <Metric icon={Building2} label="Implantações" value={implementations.length} />
          <Metric icon={CheckCircle2} label="Cadastro" value={registration.label} tone={registration.complete === 4 ? "success" : "warning"} />
          <Metric icon={ShieldCheck} label="Portal" value={hasActivePortal ? "Ativo" : "Sem acesso"} tone={hasActivePortal ? "success" : "neutral"} />
          <Metric icon={Clock3} label="Pendências" value={pending.length} tone={pending.length ? "warning" : "success"} />
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as WorkspaceTab)} className="min-w-0">
        <div className="max-w-full overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start rounded-none border-b border-border bg-transparent p-0">
            {([ ["resumo", "Resumo"], ["imoveis", "Imóveis"], ["implantacoes", "Implantações"], ["contratos", "Contratos"], ["financeiro", "Financeiro"], ["documentos", "Documentos"], ["portal", "Portal"], ["historico", "Histórico"] ] as const).map(([value, label]) =>
              <TabsTrigger key={value} value={value} className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:shadow-none">{label}</TabsTrigger>,
            )}
          </TabsList>
        </div>

        <TabsContent value="resumo" className="mt-4">
          <Summary
            owner={owner} editing={editing} onEditingChange={setEditing}
            properties={properties} registration={registrationQ.data ?? null}
            canSeeBanking={canSeeBanking} tasks={tasks} timeline={timeline.slice(0, 5)}
            hasDocuments={hasDocuments} hasContract={contracts.some((item) => Boolean(item.signedAt))}
          />
        </TabsContent>
        <TabsContent value="imoveis" className="mt-4"><ListPanel title="Imóveis vinculados" empty="Nenhum imóvel vinculado a este proprietário.">{properties.map((item) => <LinkedRow key={item.id} to="/imoveis/$id" id={item.id} title={item.name} meta={[item.condominiumName, item.unit, item.city].filter(Boolean).join(" · ")} />)}</ListPanel></TabsContent>
        <TabsContent value="implantacoes" className="mt-4"><ListPanel title="Implantações" empty="Nenhuma implantação vinculada a este proprietário.">{implementations.map((item) => <LinkedRow key={item.id} to="/implantacao/$id" id={item.id} title={`${item.code} · ${propertyLabel(item)}`} meta={statusLabels[item.status]} />)}</ListPanel></TabsContent>
        <TabsContent value="contratos" className="mt-4"><ListPanel title="Contratos" empty="Nenhum contrato vinculado a este proprietário.">{contracts.map((item) => <LinkedRow key={item.id} to="/contratos/$id" id={item.id} title={item.code} meta={`${item.type} · ${item.status}`} />)}</ListPanel></TabsContent>
        <TabsContent value="financeiro" className="mt-4">{canSeeBanking ? <FinancialPanel payouts={payouts} invoices={invoices} /> : <Restricted label="Dados financeiros" />}</TabsContent>
        <TabsContent value="documentos" className="mt-4">{canSeeDocuments ? <DocumentsPanel ownerId={owner.id} /> : <Restricted label="Documentos" />}</TabsContent>
        <TabsContent value="portal" className="mt-4"><PortalPanel implementations={implementations} links={links} onOpen={openPortal} onManage={() => setPortalOpen(true)} /></TabsContent>
        <TabsContent value="historico" className="mt-4"><div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]"><Section title="Atividade recente"><Timeline entries={timeline} /></Section><NotesPanel ownerId={owner.id} /></div></TabsContent>
      </Tabs>

      {portalImplementation ? <OwnerPortalAccess open={portalOpen} onClose={() => setPortalOpen(false)} implementation={portalImplementation} checklist={checklistQ.data ?? []} /> : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === "Ativo" ? "bg-success/10 text-success" : status === "Em implantação" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{status}</span>;
}

function Metric({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof Home; label: string; value: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <div className="min-w-0 rounded-md border border-border bg-background px-3 py-3"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><Icon size={14} className="text-brand" />{label}</div><p className={`mt-1 truncate font-display text-lg font-semibold ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</p></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)]"><div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">{title}</h2></div><div className="p-4">{children}</div></section>;
}

function Summary({ owner, editing, onEditingChange, properties, registration, canSeeBanking, tasks, timeline, hasDocuments, hasContract }: {
  owner: OwnerRecord; editing: boolean; onEditingChange: (value: boolean) => void; properties: Property[];
  registration: OwnerAdministrativeRegistration | null; canSeeBanking: boolean; tasks: Awaited<ReturnType<typeof adminApi.ownerTasks.listByOwner>>;
  timeline: TimelineEntry[]; hasDocuments: boolean; hasContract: boolean;
}) {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]"><div className="space-y-4"><Section title="Contato"><Contact owner={owner} editing={editing} onEditingChange={onEditingChange} /></Section><Section title="Imóveis"><div className="space-y-1">{properties.length ? properties.slice(0, 3).map((item) => <LinkedRow key={item.id} to="/imoveis/$id" id={item.id} title={item.name} meta={[item.condominiumName, item.unit].filter(Boolean).join(" · ")} />) : <Empty text="Nenhum imóvel vinculado ainda." />}</div></Section><Section title="Pendências"><Tasks ownerId={owner.id} tasks={tasks} /></Section></div><div className="space-y-4"><Section title="Status cadastral"><div className="space-y-3"><StatusLine label="Dados pessoais" complete={Boolean(registration?.submittedAt || owner.document)} /><StatusLine label="Dados bancários" complete={Boolean(registration?.pixKey)} /><StatusLine label="Documentos" complete={hasDocuments} /><StatusLine label="Contrato" complete={hasContract} /></div></Section><Section title="Conta de repasse">{canSeeBanking ? <PayoutAccount registration={registration} /> : <Restricted label="Dados bancários" compact />}</Section><Section title="Atividade recente"><Timeline entries={timeline} /></Section></div></div>;
}

function Contact({ owner, editing, onEditingChange }: { owner: OwnerRecord; editing: boolean; onEditingChange: (value: boolean) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: owner.name, phone: owner.phone ?? "", email: owner.email ?? "", document: owner.document ?? "" });
  useEffect(() => setForm({ name: owner.name, phone: owner.phone ?? "", email: owner.email ?? "", document: owner.document ?? "" }), [owner]);
  const save = useMutation({
    mutationFn: () => adminApi.owners.update(owner.id, { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, document: form.document.trim() || null }),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["owners", "detail", owner.id] }), queryClient.invalidateQueries({ queryKey: ["owners", "list"] })]); onEditingChange(false); },
  });
  if (!editing) return <dl className="grid gap-4 sm:grid-cols-3"><Data label="Telefone" value={owner.phone} icon={MessageCircle} /><Data label="E-mail" value={owner.email} icon={Mail} /><Data label="Canal preferido" value={owner.phone ? "WhatsApp" : owner.email ? "E-mail" : null} icon={UserRound} /></dl>;
  return <div className="grid gap-3 sm:grid-cols-2">{([ ["Nome", "name"], ["Telefone", "phone"], ["E-mail", "email"], ["CPF/CNPJ", "document"] ] as const).map(([label, key]) => <label key={key} className="text-xs font-semibold text-muted-foreground">{label}<input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground" /></label>)}<div className="flex gap-2 sm:col-span-2"><Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button><Button variant="ghost" onClick={() => onEditingChange(false)}>Cancelar</Button></div></div>;
}

function PayoutAccount({ registration }: { registration: OwnerAdministrativeRegistration | null }) {
  if (!registration?.pixKey) return <Empty text="Conta de repasse ainda não informada." />;
  return <dl className="grid gap-3"><Data label="Banco" value={registration.bankName} /><Data label="Tipo de PIX" value={registration.pixType ? pixLabels[registration.pixType] : null} /><Data label="PIX" value={maskPixKey(registration.pixKey)} /><Data label="Titular" value={registration.accountHolder} /></dl>;
}
function Data({ label, value, icon: Icon }: { label: string; value: ReactNode; icon?: typeof Home }) { return <div><dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">{Icon ? <Icon size={13} /> : null}{label}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{value || "—"}</dd></div>; }
function StatusLine({ label, complete }: { label: string; complete: boolean }) { return <div className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><span className={`inline-flex items-center gap-1 text-xs font-semibold ${complete ? "text-success" : "text-warning"}`}>{complete ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{complete ? "Completo" : "Pendente"}</span></div>; }
function Empty({ text }: { text: string }) { return <p className="text-sm text-muted-foreground">{text}</p>; }
function Restricted({ label, compact = false }: { label: string; compact?: boolean }) { return <div className={compact ? "text-center" : "rounded-[var(--radius-card)] border border-border bg-card p-8 text-center"}><ShieldCheck className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm font-semibold">Acesso restrito</p><p className="mt-1 text-xs text-muted-foreground">{label} respeitam as permissões do seu perfil.</p></div>; }

function ListPanel({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) { return <Panel><div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">{title}</h2></div><div className="divide-y divide-border">{children.length ? children : <div className="px-4 py-10 text-center"><Empty text={empty} /></div>}</div></Panel>; }
function LinkedRow({ to, id, title, meta }: { to: "/imoveis/$id" | "/implantacao/$id" | "/contratos/$id"; id: string; title: string; meta: string }) { return <Link to={to} params={{ id }} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/60"><div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p>{meta ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p> : null}</div><span className="text-brand">→</span></Link>; }

function Tasks({ ownerId, tasks }: { ownerId: string; tasks: Awaited<ReturnType<typeof adminApi.ownerTasks.listByOwner>> }) {
  const queryClient = useQueryClient();
  const resolve = useMutation({ mutationFn: (id: string) => adminApi.ownerTasks.updateStatus(id, "done"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-tasks", ownerId] }) });
  const pending = pendingOwnerTasks(tasks);
  if (!pending.length) return <Empty text="Nenhuma ação necessária no momento." />;
  return <div className="divide-y divide-border">{pending.map((task) => <div key={task.id} className="flex items-center justify-between gap-3 py-2"><div><p className="text-sm font-medium">{task.title}</p>{task.description ? <p className="text-xs text-muted-foreground">{task.description}</p> : null}</div><Button variant="outline" size="sm" onClick={() => resolve.mutate(task.id)}>Resolver</Button></div>)}</div>;
}

function FinancialPanel({ payouts, invoices }: { payouts: Payout[]; invoices: ServiceInvoice[] }) {
  const amount = payouts.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const open = invoices.filter((item) => !item.paidAt);
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Metric icon={CheckCircle2} label="Total repassado" value={formatMoney(amount)} /><Metric icon={Clock3} label="Faturas pendentes" value={`${open.length} · ${formatMoney(open.reduce((sum, item) => sum + item.total, 0))}`} tone={open.length ? "warning" : "success"} /></div><ListPanel title="Repasses" empty="Nenhum repasse disponível.">{payouts.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span>{item.propertyName ?? "Imóvel"}</span><strong>{formatMoney(item.amount) ?? "—"}</strong></div>)}</ListPanel></div>;
}

function DocumentsPanel({ ownerId }: { ownerId: string }) {
  const available = isAttachmentsAvailable();
  const query = useQuery({ queryKey: ["owner-attachments", ownerId], queryFn: () => listOwnerAttachments(ownerId), enabled: available });
  if (!available) return <Panel><div className="p-8 text-center"><Empty text="Documentos privados não estão disponíveis neste ambiente." /></div></Panel>;
  if (query.isError) return <ErrorRows onRetry={() => void query.refetch()} />;
  return <ListPanel title="Documentos" empty="Nenhum documento enviado ainda.">{(query.data ?? []).map((item) => <div key={item.id} className="flex items-center gap-2 px-4 py-3 text-sm"><FileText size={16} className="text-brand" /><span className="truncate">{item.filename}</span><span className="ml-auto text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span></div>)}</ListPanel>;
}

function PortalPanel({ implementations, links, onOpen, onManage }: { implementations: ImplementationProject[]; links: Array<OwnerOnboardingLink | null>; onOpen: () => void; onManage: () => void }) {
  const active = links.find((link) => link && ownerOnboardingLinkStatus(link) === "ativo") ?? null;
  const latest = active ?? links.find(Boolean) ?? null;
  return <Section title="Acesso ao Portal do Proprietário"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]"><div><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`} /><p className="font-semibold">{active ? "Acesso ativo" : latest ? "Sem acesso ativo" : "Acesso ainda não criado"}</p></div>{latest ? <div className="mt-3 space-y-1 text-sm text-muted-foreground"><p>Criado em {new Date(latest.createdAt).toLocaleString("pt-BR")}</p><p>Último acesso: {latest.lastAccessAt ? new Date(latest.lastAccessAt).toLocaleString("pt-BR") : "Ainda não acessado"}</p><p>Link ativo: {active ? "Sim" : "Não"}</p></div> : <p className="mt-3 text-sm text-muted-foreground">Crie um link seguro para o portal a partir da implantação vinculada.</p>}</div><div className="flex flex-wrap items-start gap-2"><Button variant="outline" onClick={onOpen} disabled={!active}><ExternalLink />Visualizar portal</Button><Button onClick={onManage} disabled={!implementations.length}><ShieldCheck />{active ? "Gerenciar acesso" : "Gerar acesso"}</Button></div></div></Section>;
}

function NotesPanel({ ownerId }: { ownerId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery(ownerNoteQuery(ownerId));
  const [draft, setDraft] = useState("");
  useEffect(() => setDraft(query.data?.content ?? ""), [query.data]);
  const save = useMutation({ mutationFn: (value: string) => ownerNotesStore.save(ownerId, value), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-notes", ownerId] }) });
  return <Section title="Notas internas"><textarea rows={6} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Observações da equipe" className="w-full rounded-md border border-input bg-background p-3 text-sm" />{draft !== (query.data?.content ?? "") ? <Button className="mt-2" size="sm" onClick={() => save.mutate(draft)}>Salvar</Button> : null}</Section>;
}

function propertyLabel(item: ImplementationProject) { return [item.condominiumName, item.unit].filter(Boolean).join(" ") || item.nickname || "Imóvel sem identificação"; }
function buildTimeline({ contracts, invoices, reservations, implementations }: { contracts: Contract[]; invoices: ServiceInvoice[]; reservations: Reservation[]; implementations: ImplementationProject[] }): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const item of implementations) entries.push({ id: `implementation-${item.id}`, label: `${item.code}: ${statusLabels[item.status]}`, timestamp: item.updatedAt });
  for (const item of contracts) if (item.signedAt) entries.push({ id: `contract-${item.id}`, label: `Contrato ${item.code} assinado`, timestamp: item.signedAt });
  for (const item of invoices) if (item.issuedAt) entries.push({ id: `invoice-${item.id}`, label: `Fatura ${item.code} emitida`, timestamp: item.issuedAt });
  for (const item of reservations) entries.push({ id: `reservation-${item.id}`, label: `Reserva ${item.externalId ?? item.id}: ${item.checkin} → ${item.checkout}`, timestamp: item.checkin });
  return entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
