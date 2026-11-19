import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Brush, CheckCircle2, Sparkles, TriangleAlert, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { Button } from "@/components/ui/button";
import { CleanPropertyDialog } from "@/components/admin/CleanPropertyDialog";
import { SyncUpcomingButton } from "@/components/admin/SyncUpcomingButton";
import { assignRoutine, cleaningBoardQuery, markDirty, type CleaningRow } from "@/lib/api/op-cleaning-api";
import { opStaffQuery } from "@/lib/api/op-execution";
import { localISODate } from "@/lib/local-date";
import type { CleaningState } from "@/lib/op-cleaning";

export const Route = createFileRoute("/operacao/limpeza")({
  head: () => ({ meta: [
    { title: "Limpeza dos imóveis — Stayo Admin" },
    { name: "description", content: "Painel de imóveis limpos, sujos e ocupados, com rotinas de limpeza e profissionais." },
    { property: "og:title", content: "Limpeza dos imóveis — Stayo Admin" },
    { property: "og:description", content: "Painel de imóveis limpos, sujos e ocupados, com rotinas de limpeza e profissionais." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CleaningPage,
});

const stateInfo: Record<CleaningState, { label: string; tone: "success" | "danger" | "info" | "neutral" }> = {
  pronto: { label: "Pronto", tone: "success" }, sujo: { label: "Sujo", tone: "danger" }, ocupado: { label: "Ocupado", tone: "info" }, sem_registro: { label: "Sem registro", tone: "neutral" },
};
const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
type Filter = "todos" | CleaningState;

function CleaningPage() {
  const today = localISODate();
  const qc = useQueryClient();
  const board = useQuery(cleaningBoardQuery(today));
  const staff = useQuery(opStaffQuery());
  const [filter, setFilter] = useState<Filter>("todos");
  const [cleaning, setCleaning] = useState<CleaningRow | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["op-cleaning"] }); qc.invalidateQueries({ queryKey: ["op-tasks"] }); qc.invalidateQueries({ queryKey: ["op-costs"] }); };
  const dirty = useMutation({ mutationFn: (id: string) => markDirty(id, today), onSuccess: () => { toast.success("Imóvel marcado como sujo; limpeza criada para hoje."); refresh(); }, onError: (e) => toast.error((e as Error).message) });
  const assign = useMutation({ mutationFn: (v: { id: string; staffId: string }) => assignRoutine(v.id, v.staffId, staff.data?.find((s) => s.id === v.staffId)?.name ?? ""),
    onSuccess: () => { toast.success("Profissional vinculado."); refresh(); }, onError: (e) => toast.error((e as Error).message) });

  const rows = board.data?.rows ?? [];
  const count = (s: CleaningState) => rows.filter((r) => r.status.state === s).length;
  const shown = useMemo(() => [...(filter === "todos" ? rows : rows.filter((r) => r.status.state === filter))]
    .sort((a, b) => order[a.status.state] - order[b.status.state] || a.property.localeCompare(b.property)), [rows, filter]);
  const open = board.data?.open ?? [];
  const unassigned = open.filter((r) => !r.staffId).length;
  const activeStaff = (staff.data ?? []).filter((s) => s.active);

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Limpeza dos imóveis" description="Marque o que está limpo ou sujo. Cada saída de hóspede gera uma limpeza; sem nova reserva, o imóvel segue pronto." actions={<SyncUpcomingButton />} />
    <div className="portfolio-metrics">
      <PortfolioMetric icon={Sparkles} value={count("pronto")} label="Prontos" tone="success" />
      <PortfolioMetric icon={Brush} value={count("sujo")} label="Sujos" tone={count("sujo") ? "warning" : "success"} />
      <PortfolioMetric icon={BedDouble} value={count("ocupado")} label="Ocupados" tone="info" />
      <PortfolioMetric icon={UserRound} value={unassigned} label="Rotinas sem profissional" tone={unassigned ? "warning" : "success"} />
    </div>
    <ModuleTabs value={filter} onChange={setFilter} options={[
      { value: "todos", label: `Todos (${rows.length})` }, { value: "sujo", label: `Sujos (${count("sujo")})` },
      { value: "pronto", label: `Prontos (${count("pronto")})` }, { value: "ocupado", label: `Ocupados (${count("ocupado")})` },
    ]} />

    {board.isPending ? <div className="admin-panel p-5 text-sm text-[var(--admin-muted)]">Carregando imóveis…</div>
      : board.isError ? <div className="admin-panel p-5 text-sm">Não foi possível carregar o painel.</div>
      : shown.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Sparkles} title="Nenhum imóvel nesta situação" description="Troque o filtro para ver os demais." /></div>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((r) => {
          const info = stateInfo[r.status.state];
          return <article key={r.id} className="admin-panel flex flex-col gap-3 p-4">
            <header className="flex items-start justify-between gap-2">
              <div className="min-w-0"><h2 className="truncate font-[var(--stayo-font-display)] text-base">{r.property}</h2><small className="text-xs text-[var(--admin-muted)]">{r.code}</small></div>
              <AdminStatusBadge tone={info.tone}>{info.label}</AdminStatusBadge>
            </header>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-[var(--admin-muted)]">Última limpeza</dt><dd className="font-medium">{dm(r.status.lastCleaning)}</dd></div>
              <div><dt className="text-[var(--admin-muted)]">Última saída</dt><dd className="font-medium">{dm(r.status.lastCheckout)}</dd></div>
              <div><dt className="text-[var(--admin-muted)]">Próxima entrada</dt><dd className="font-medium">{dm(r.status.nextCheckin)}</dd></div>
              <div><dt className="text-[var(--admin-muted)]">Próxima limpeza</dt><dd className="font-medium">{r.next ? `${dm(r.next.dueDate)}${r.next.staffName ? ` · ${r.next.staffName}` : ""}` : "—"}</dd></div>
            </dl>
            <div className="mt-auto flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setCleaning(r)}><CheckCircle2 className="size-4" />Marcar limpo</Button>
              {r.status.state !== "sujo" && <Button size="sm" variant="outline" disabled={dirty.isPending} onClick={() => dirty.mutate(r.id)}><TriangleAlert className="size-4" />Sujo</Button>}
            </div>
          </article>;
        })}</div>}

    <section className="admin-panel overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
        <h2 className="font-[var(--stayo-font-display)] text-base">Próximas limpezas</h2>
        <small className="text-xs text-[var(--admin-muted)]">{open.length} rotina(s) · {unassigned} sem profissional</small>
      </header>
      {open.length === 0 ? <p className="p-4 text-sm text-[var(--admin-muted)]">Nenhuma limpeza em aberto. Novas reservas geram a limpeza do dia da saída automaticamente.</p>
        : <div className="divide-y divide-[var(--admin-border)]">{open.map((t) => <div key={t.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[3.25rem_minmax(0,1fr)_14rem]">
            <strong className={`text-sm tabular-nums ${t.dueDate < today ? "text-[var(--admin-danger)]" : "text-[var(--admin-primary)]"}`}>{dm(t.dueDate)}</strong>
            <span className="min-w-0"><b className="block truncate text-sm">{t.property}</b><small className="block truncate text-[var(--admin-muted)]">{t.fromReservation ? "Saída de hóspede" : "Limpeza solicitada"}{t.amount != null ? ` · ${t.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}{t.dueDate < today ? " · atrasada" : ""}</small></span>
            <select aria-label={`Profissional da limpeza de ${t.property} em ${dm(t.dueDate)}`} className="admin-input col-span-2 h-10 px-3 text-sm sm:col-span-1" value={t.staffId ?? ""} disabled={assign.isPending}
              onChange={(e) => assign.mutate({ id: t.id, staffId: e.target.value })}>
              <option value="">Sem profissional</option>
              {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>)}</div>}
    </section>
    <p className="text-xs text-[var(--admin-muted)]">A situação considera as reservas importadas do Guia (mês atual e próximos 2 meses ao puxar) e as limpezas registradas no Admin. Limpezas marcadas entram na Agenda e em Custos.</p>
    <CleanPropertyDialog row={cleaning} staff={activeStaff} today={today} onClose={() => setCleaning(null)} onDone={refresh} />
  </div>;
}

const order: Record<CleaningState, number> = { sujo: 0, ocupado: 1, sem_registro: 2, pronto: 3 };
