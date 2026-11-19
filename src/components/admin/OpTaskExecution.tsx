import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OpChecklistList } from "@/components/admin/OpChecklistList";
import { Button } from "@/components/ui/button";
import { applyTemplate, opExecutionQuery, opStaffQuery, opTemplatesQuery, saveTeam, setTaskStatus, toggleItem, uploadItemPhoto } from "@/lib/api/op-execution";
import { blockerMessage } from "@/lib/op-execution-rules";

type Member = { staff_id: string; share: number; is_lead: boolean };
const field = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** Equipe, checklist e execução de uma tarefa do Admin. */
export function OpTaskExecution({ taskId }: { taskId: string }) {
  const qc = useQueryClient();
  const exec = useQuery(opExecutionQuery(taskId));
  const staff = useQuery(opStaffQuery());
  const templates = useQuery(opTemplatesQuery());
  const [team, setTeam] = useState<Member[]>([]);
  useEffect(() => { if (exec.data) setTeam(exec.data.team.map(({ staff_id, share, is_lead }) => ({ staff_id, share, is_lead }))); }, [exec.data]);
  const refresh = () => { for (const key of ["op-tasks", "op-movements", "op-cleaning"]) void qc.invalidateQueries({ queryKey: [key] }); };
  const onErr = (e: Error) => toast.error(e.message);
  const teamMut = useMutation({ mutationFn: () => saveTeam(taskId, team), onSuccess: () => { toast.success("Equipe salva"); refresh(); }, onError: onErr });
  const items = exec.data?.items ?? [];
  const progress = items.some((i) => i.checked_at || i.photo_path);
  const tplMut = useMutation({ mutationFn: (id: string | null) => applyTemplate(taskId, id, progress), onSuccess: refresh, onError: onErr });
  const statusMut = useMutation({ mutationFn: (s: "em_andamento" | "concluida" | "pendente") => setTaskStatus(taskId, s, items), onSuccess: (_, s) => { toast.success(s === "concluida" ? "Tarefa concluída" : s === "em_andamento" ? "Tarefa iniciada" : "Tarefa reaberta"); refresh(); }, onError: onErr });

  if (exec.isPending) return <p className="text-sm text-muted-foreground">Carregando execução…</p>;
  if (exec.isError) return <p className="text-sm text-destructive">Não foi possível carregar a execução.</p>;
  const { task } = exec.data;
  const finished = task.status === "concluida" || task.status === "cancelada";
  const available = (staff.data ?? []).filter((s) => s.active && !team.some((m) => m.staff_id === s.id));
  const nameOf = (id: string) => staff.data?.find((s) => s.id === id)?.name ?? exec.data.team.find((m) => m.staff_id === id)?.name ?? "—";
  const blockers = blockerMessage(items);
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

  return <div className="grid gap-5 border-t border-border pt-4">
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">Equipe</h3>
      {team.length === 0 && <p className="text-xs text-muted-foreground">Ninguém escalado. A tarefa aparece no Meu Dia de quem estiver na equipe.</p>}
      {team.map((m, idx) => <div key={m.staff_id} className="grid grid-cols-[minmax(0,1fr)_5rem_auto_auto] items-center gap-2">
        <span className="truncate text-sm">{nameOf(m.staff_id)}</span>
        <label className="flex items-center gap-1 text-xs text-muted-foreground"><input aria-label={`Percentual de ${nameOf(m.staff_id)}`} inputMode="decimal" className={field} value={m.share} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")) || 0; setTeam((t) => t.map((x, i) => i === idx ? { ...x, share: v } : x)); }} />%</label>
        <label className="flex items-center gap-1 text-xs"><input type="radio" name={`lead-${taskId}`} checked={m.is_lead} onChange={() => setTeam((t) => t.map((x, i) => ({ ...x, is_lead: i === idx })))} />Principal</label>
        <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${nameOf(m.staff_id)}`} onClick={() => setTeam((t) => t.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>
      </div>)}
      <div className="flex gap-2">
        <select aria-label="Adicionar à equipe" className={field} value="" onChange={(e) => { const id = e.target.value; if (!id) return; setTeam((t) => { const next = [...t, { staff_id: id, share: 0, is_lead: t.length === 0 }]; const each = Math.round((100 / next.length) * 100) / 100; return next.map((x, i) => ({ ...x, share: i === next.length - 1 ? Math.round((100 - each * (next.length - 1)) * 100) / 100 : each })); }); }}>
          <option value="">Adicionar pessoa…</option>{available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={teamMut.isPending} onClick={() => teamMut.mutate()}>Salvar equipe</Button>
      </div>
    </section>

    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Checklist</h3>
        <select aria-label="Modelo de checklist" className={`${field} max-w-[14rem]`} disabled={progress || finished || tplMut.isPending} value={task.checklist_template_id ?? ""} onChange={(e) => tplMut.mutate(e.target.value || null)}>
          <option value="">Sem checklist</option>{(templates.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <OpChecklistList items={items} disabled={finished}
        onToggle={async (id, c) => { try { await toggleItem(id, c, "Admin"); refresh(); } catch (e) { onErr(e as Error); } }}
        onPhoto={async (id, b64) => { try { await uploadItemPhoto(taskId, id, b64); refresh(); } catch (e) { onErr(e as Error); } }} />
    </section>

    <section className="grid gap-2">
      <p className="text-xs text-muted-foreground">{task.started_at ? `Iniciada em ${fmt(task.started_at)}` : "Ainda não iniciada"}{task.completed_at ? ` · concluída em ${fmt(task.completed_at)}` : ""}</p>
      {!finished && blockers && task.status === "em_andamento" && <p className="text-xs text-destructive">{blockers}</p>}
      <div className="flex flex-wrap gap-2">
        {task.status === "pendente" && <Button type="button" variant="outline" onClick={() => statusMut.mutate("em_andamento")} disabled={statusMut.isPending}><Play className="size-4" />Iniciar</Button>}
        {!finished && <Button type="button" onClick={() => statusMut.mutate("concluida")} disabled={statusMut.isPending || !!blockers}><CheckCircle2 className="size-4" />Concluir</Button>}
        {finished && <Button type="button" variant="outline" onClick={() => statusMut.mutate("pendente")} disabled={statusMut.isPending}><RotateCcw className="size-4" />Reabrir</Button>}
      </div>
    </section>
  </div>;
}
