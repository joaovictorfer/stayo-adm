import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus, Receipt, Users, Wallet, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MonthPicker } from "@/components/ui/month-picker";
import { opStaffQuery } from "@/lib/api/op-execution";
import { createExpense, deleteExpense, opCostsQuery, setExpenseStatus } from "@/lib/api/op-costs-api";
import { opPropertiesQuery } from "@/lib/api/op-tasks";
import { compressImageToBase64 } from "@/lib/image-compress";
import { computeOpCosts } from "@/lib/op-costs";

export const Route = createFileRoute("/operacao/custos")({
  head: () => ({ meta: [
    { title: "Custos operacionais — Stayo Admin" },
    { name: "description", content: "Custos de serviços e reembolsos da operação por imóvel e por pessoa." },
    { property: "og:title", content: "Custos operacionais — Stayo Admin" },
    { property: "og:description", content: "Custos de serviços e reembolsos da operação Stayo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CustosPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const now = new Date(); const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const statusTone = { pendente: "warning", aprovado: "info", pago: "success", recusado: "neutral" } as const;
const statusLabel = { pendente: "Pendente", aprovado: "Aprovado", pago: "Pago", recusado: "Recusado" } as const;
const catLabel: Record<string, string> = { material: "Material", transporte: "Transporte", servico_extra: "Serviço extra", outro: "Outro" };

function CustosPage() {
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"pessoas" | "imoveis" | "reembolsos">("pessoas");
  const [open, setOpen] = useState(false);
  const q = useQuery(opCostsQuery(month));
  const qc = useQueryClient();
  const r = useMemo(() => q.data ? computeOpCosts(q.data.tasks, q.data.expenses, month) : null, [q.data, month]);
  const onErr = (e: Error) => toast.error(e.message);
  const statusMut = useMutation({ mutationFn: (v: { id: string; s: "aprovado" | "pago" | "recusado" | "pendente" }) => setExpenseStatus(v.id, v.s), onSuccess: () => qc.invalidateQueries({ queryKey: ["op-costs"] }), onError: onErr });
  const delMut = useMutation({ mutationFn: deleteExpense, onSuccess: () => { toast.success("Lançamento excluído"); void qc.invalidateQueries({ queryKey: ["op-costs"] }); }, onError: onErr });
  const th = "px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)]";
  const td = "px-4 py-3 text-sm";

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Custos operacionais" description="Serviços concluídos pela equipe e reembolsos do mês. Registro interno: não altera repasses nem o financeiro."
      actions={<div className="flex flex-wrap gap-2"><MonthPicker value={month} onValueChange={setMonth} aria-label="Mês de competência" /><Button onClick={() => setOpen(true)}><Plus className="size-4" />Reembolso</Button></div>} />
    {q.isPending ? <div className="admin-panel p-5 text-sm text-[var(--admin-muted)]">Calculando custos…</div>
      : q.isError || !r ? <div className="admin-panel"><AdminEmptyState title="Custos indisponíveis" description="Não foi possível carregar tarefas e reembolsos." /></div>
      : <>
        <div className="portfolio-metrics lg:!grid-cols-4">
          <PortfolioMetric icon={Wrench} value={brl(r.services)} label={`Serviços · ${r.tasksDone} ${r.tasksDone === 1 ? "tarefa" : "tarefas"}`} tone="info" />
          <PortfolioMetric icon={Receipt} value={brl(r.expenses)} label="Reembolsos" tone="neutral" />
          <PortfolioMetric icon={Wallet} value={brl(r.total)} label="Custo total" tone="success" />
          <PortfolioMetric icon={AlertTriangle} value={brl(r.pendingApproval)} label="A aprovar" tone={r.pendingApproval ? "warning" : "success"} />
        </div>
        {r.unpriced > 0 && <p className="text-xs text-[var(--admin-warning,inherit)]">{r.unpriced} {r.unpriced === 1 ? "tarefa concluída está" : "tarefas concluídas estão"} sem valor informado e não {r.unpriced === 1 ? "entra" : "entram"} na soma.</p>}
        <ModuleTabs value={tab} onChange={setTab} options={[{ value: "pessoas", label: "Por pessoa" }, { value: "imoveis", label: "Por imóvel" }, { value: "reembolsos", label: `Reembolsos (${q.data.expenses.length})` }]} />
        {tab === "pessoas" && (r.people.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Users} title="Sem custos neste mês" description="Os valores aparecem quando tarefas com valor são concluídas ou reembolsos são lançados." /></div>
          : <><div className="grid gap-2 sm:hidden">{r.people.map((p) => <div key={p.key} className="admin-panel grid gap-1 p-4 text-sm"><div className="flex items-start justify-between gap-2"><b>{p.name}</b><strong>{brl(p.toPay)}</strong></div>
              <small className="text-[var(--admin-muted)]">{p.tasks} {p.tasks === 1 ? "tarefa" : "tarefas"} · serviços {brl(p.services)} · reembolso aprovado {brl(p.reimbApproved)}</small>
              {(p.reimbPending > 0 || p.reimbPaid > 0) && <small className="text-[var(--admin-muted)]">Pendente {brl(p.reimbPending)} · já pago {brl(p.reimbPaid)}</small>}</div>)}</div>
            <div className="admin-panel hidden overflow-x-auto sm:block"><table className="w-full min-w-[40rem]"><thead className="border-b border-[var(--admin-border)]"><tr><th className={th}>Pessoa</th><th className={th}>Serviços</th><th className={th}>Reembolso aprovado</th><th className={th}>Pendente</th><th className={th}>Já pago</th><th className={th}>A pagar</th></tr></thead>
            <tbody className="divide-y divide-[var(--admin-border)]">{r.people.map((p) => <tr key={p.key}><td className={td}><b>{p.name}</b><small className="block text-[var(--admin-muted)]">{p.tasks} {p.tasks === 1 ? "tarefa" : "tarefas"}</small></td><td className={td}>{brl(p.services)}</td><td className={td}>{brl(p.reimbApproved)}</td><td className={td}>{brl(p.reimbPending)}</td><td className={td}>{brl(p.reimbPaid)}</td><td className={`${td} font-semibold`}>{brl(p.toPay)}</td></tr>)}</tbody></table></div></>)}
        {tab === "imoveis" && (r.properties.length === 0 ? <div className="admin-panel"><AdminEmptyState title="Sem custos neste mês" description="Nenhum imóvel teve custo operacional no período." /></div>
          : <div className="admin-panel overflow-x-auto"><table className="w-full min-w-[32rem]"><thead className="border-b border-[var(--admin-border)]"><tr><th className={th}>Imóvel</th><th className={th}>Serviços</th><th className={th}>Gastos</th><th className={th}>Total</th></tr></thead>
            <tbody className="divide-y divide-[var(--admin-border)]">{r.properties.map((p) => <tr key={p.key}><td className={td}><b>{p.name}</b><small className="block text-[var(--admin-muted)]">{p.tasks} {p.tasks === 1 ? "tarefa concluída" : "tarefas concluídas"}</small></td><td className={td}>{brl(p.services)}</td><td className={td}>{brl(p.expenses)}</td><td className={`${td} font-semibold`}>{brl(p.total)}</td></tr>)}</tbody></table></div>)}
        {tab === "reembolsos" && (q.data.expenses.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Receipt} title="Nenhum reembolso neste mês" description="Use o botão Reembolso para lançar materiais, transporte ou serviços extras." /></div>
          : <div className="admin-panel divide-y divide-[var(--admin-border)]">{q.data.expenses.map((e) => <div key={e.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{e.description}</b><AdminStatusBadge tone={statusTone[e.status]}>{statusLabel[e.status]}</AdminStatusBadge></div>
                <small className="block text-[var(--admin-muted)]">{new Date(`${e.date}T12:00:00`).toLocaleDateString("pt-BR")} · {catLabel[e.category] ?? e.category} · {e.staffName ?? "Sem pessoa"} · {e.propertyName ?? "Sem imóvel"}{e.receiptUrl && <> · <a className="underline" href={e.receiptUrl} target="_blank" rel="noreferrer">comprovante</a></>}</small></div>
              <div className="flex flex-wrap items-center gap-2"><strong className="mr-2 text-sm">{brl(e.amount)}</strong>
                {e.status === "pendente" && <><Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: e.id, s: "aprovado" })}>Aprovar</Button><Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ id: e.id, s: "recusado" })}>Recusar</Button></>}
                {e.status === "aprovado" && <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: e.id, s: "pago" })}>Marcar pago</Button>}
                {e.status !== "pendente" && <Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ id: e.id, s: "pendente" })}>Voltar a pendente</Button>}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Excluir este lançamento?")) delMut.mutate(e.id); }}>Excluir</Button></div>
            </div>)}</div>)}
      </>}
    <p className="text-xs text-[var(--admin-muted)]">Serviços contam tarefas concluídas no mês com valor, divididas pelos percentuais da equipe. A pagar = serviços + reembolsos aprovados.</p>
    <ExpenseDialog open={open} onOpenChange={setOpen} defaultDate={month === currentMonth ? now.toISOString().slice(0, 10) : `${month}-01`} />
  </div>;
}

function ExpenseDialog({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (v: boolean) => void; defaultDate: string }) {
  const qc = useQueryClient();
  const staff = useQuery({ ...opStaffQuery(), enabled: open });
  const props = useQuery({ ...opPropertiesQuery(), enabled: open });
  const [f, setF] = useState({ date: defaultDate, staffId: "", implementationId: "", category: "material", description: "", amount: "" });
  const [file, setFile] = useState<File | null>(null);
  const field = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const lbl = "grid gap-1 text-xs font-medium text-muted-foreground";
  const save = useMutation({
    mutationFn: async () => createExpense({ date: f.date, staffId: f.staffId || null, implementationId: f.implementationId || null, category: f.category, description: f.description, amount: Number(f.amount.replace(/\./g, "").replace(",", ".")), receiptBase64: file ? await compressImageToBase64(file) : null }),
    onSuccess: () => { toast.success("Reembolso lançado"); setF({ date: defaultDate, staffId: "", implementationId: "", category: "material", description: "", amount: "" }); setFile(null); void qc.invalidateQueries({ queryKey: ["op-costs"] }); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md">
    <DialogHeader><DialogTitle>Novo reembolso ou gasto</DialogTitle></DialogHeader>
    <form id="exp-form" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <label className={lbl}>Descrição<input required className={field} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Produtos de limpeza" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>Valor (R$)<input required inputMode="decimal" className={field} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0,00" /></label>
        <label className={lbl}>Data<input required type="date" className={field} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      </div>
      <label className={lbl}>Categoria<select className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(catLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className={lbl}>Pessoa da equipe<select className={field} value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value })}><option value="">Sem pessoa (gasto da STAYO)</option>{(staff.data ?? []).filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className={lbl}>Imóvel<select className={field} value={f.implementationId} onChange={(e) => setF({ ...f, implementationId: e.target.value })}><option value="">Sem imóvel</option>{(props.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <label className={lbl}>Comprovante (opcional)<input type="file" accept="image/*" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
    </form>
    <DialogFooter><Button type="submit" form="exp-form" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Lançar"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
