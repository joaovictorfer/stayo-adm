import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Play, RotateCcw, Trash2, Users, ClipboardList } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { OpChecklistList } from "@/components/admin/OpChecklistList";
import { Button } from "@/components/ui/button";
import { applyTemplate, opExecutionQuery, opStaffQuery, opTemplatesQuery, saveTeam, setTaskStatus, toggleItem, uploadItemPhoto } from "@/lib/api/op-execution";
import { formatBrasiliaDateTime } from "@/lib/local-date";
import { blockerMessage, validateTeam } from "@/lib/op-execution-rules";
import { teamDraftKey } from "@/lib/op-save-state";
import { splitAmount } from "@/lib/op-costs";
import { formatBRL } from "@/lib/money";

type Member = { staff_id: string; share: number; is_lead: boolean };
const field = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** Equipe, checklist e execução de uma tarefa do Admin. */
export function OpTaskExecution({ taskId, totalAmount, onSaveStateChange }: { taskId: string; totalAmount?: number | null; onSaveStateChange?: (dirty: boolean, saving: boolean) => void }) {
  const qc = useQueryClient();
  const exec = useQuery(opExecutionQuery(taskId));
  const staff = useQuery(opStaffQuery());
  const templates = useQuery(opTemplatesQuery());
  const [team, setTeam] = useState<Member[]>([]);
  const [savedTeamKey, setSavedTeamKey] = useState<string | null>(null);
  const dirty = savedTeamKey !== null && teamDraftKey(team) !== savedTeamKey;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!exec.data || dirtyRef.current) return;
    const next = exec.data.team.map(({ staff_id, share, is_lead }) => ({ staff_id, share, is_lead }));
    setTeam(next); setSavedTeamKey(teamDraftKey(next));
  }, [exec.data]);
  const refresh = () => { for (const key of ["op-tasks", "op-movements", "op-cleaning"]) void qc.invalidateQueries({ queryKey: [key] }); };
  const onErr = (e: Error) => toast.error(e.message);
  const teamMut = useMutation({ mutationFn: (submitted: Member[]) => saveTeam(taskId, submitted), onSuccess: (_, submitted) => { setSavedTeamKey(teamDraftKey(submitted)); dirtyRef.current = false; toast.success("Equipe salva"); refresh(); }, onError: onErr });
  useEffect(() => { onSaveStateChange?.(dirty, teamMut.isPending); }, [dirty, teamMut.isPending, onSaveStateChange]);
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
  const fmt = formatBrasiliaDateTime;
  const amounts = totalAmount != null && !validateTeam(team) ? splitAmount(totalAmount, team.map((m) => m.share)) : [];

  return <div className="grid gap-5 border-t border-border pt-4">
    <fieldset disabled={teamMut.isPending} className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-primary" />Equipe e divisão</h3><span className="text-xs text-muted-foreground">{team.length} {team.length === 1 ? "profissional" : "profissionais"} · {team.reduce((sum, m) => sum + m.share, 0)}%</span></div>
      <p role="status" aria-live="polite" className={dirty ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{teamMut.isPending ? "Salvando equipe…" : dirty ? "Equipe com alterações não salvas" : "Equipe salva"}</p>
      {team.length === 0 && <p className="text-xs text-muted-foreground">Ninguém escalado. A tarefa aparece no Meu Dia de quem estiver na equipe.</p>}
      {team.map((m, idx) => <div key={m.staff_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <span className="min-w-0 break-words text-sm font-semibold">{nameOf(m.staff_id)}</span>
        <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${nameOf(m.staff_id)}`} onClick={() => setTeam((t) => t.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>
        <label className="flex max-w-[12rem] items-center gap-2 text-xs text-muted-foreground">Participação<input aria-label={`Percentual de ${nameOf(m.staff_id)}`} inputMode="decimal" className={`${field} w-16 text-right tabular-nums`} value={m.share} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")) || 0; setTeam((t) => t.map((x, i) => i === idx ? { ...x, share: v } : x)); }} />%</label>
        <label className="flex items-center justify-end gap-1 text-xs"><input type="radio" name={`lead-${taskId}`} checked={m.is_lead} onChange={() => setTeam((t) => t.map((x, i) => ({ ...x, is_lead: i === idx })))} />Líder</label>
        <dl className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"><dt className="text-xs text-muted-foreground">{dirty ? "Divisão em edição" : "Valor por profissional"}</dt><dd className="text-sm font-semibold tabular-nums">{amounts[idx] != null ? formatBRL(amounts[idx]) : totalAmount == null ? "Valor não informado" : "Divisão pendente"}</dd></dl>
      </div>)}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select aria-label="Adicionar à equipe" className={field} value="" onChange={(e) => { const id = e.target.value; if (!id) return; setTeam((t) => { const next = [...t, { staff_id: id, share: 0, is_lead: t.length === 0 }]; const each = Math.round((100 / next.length) * 100) / 100; return next.map((x, i) => ({ ...x, share: i === next.length - 1 ? Math.round((100 - each * (next.length - 1)) * 100) / 100 : each })); }); }}>
          <option value="">Adicionar pessoa…</option>{available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={teamMut.isPending || !dirty} onClick={() => teamMut.mutate(team)}><Users className="size-4" />{teamMut.isPending ? "Salvando equipe…" : "Salvar equipe"}</Button>
      </div>
    </fieldset>

    <section className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-primary" />Checklist</h3>
        <select aria-label="Modelo de checklist" className={`${field} max-w-[14rem]`} disabled={progress || finished || tplMut.isPending} value={task.checklist_template_id ?? ""} onChange={(e) => tplMut.mutate(e.target.value || null)}>
          <option value="">Sem checklist</option>{(templates.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <OpChecklistList items={items} disabled={finished}
        onToggle={async (id, c) => { try { await toggleItem(id, c, "Admin"); refresh(); } catch (e) { onErr(e as Error); } }}
        onPhoto={async (id, b64) => { try { await uploadItemPhoto(taskId, id, b64); refresh(); } catch (e) { onErr(e as Error); } }} />
    </section>

    <section className="grid gap-2">
      <dl className="grid gap-2 text-xs text-muted-foreground"><div><dt>Início</dt><dd className="mt-1 text-foreground">{task.started_at ? fmt(task.started_at) : "Ainda não iniciada"}</dd></div>{task.completed_at && <div><dt>Conclusão</dt><dd className="mt-1 text-foreground">{fmt(task.completed_at)}</dd></div>}</dl>
      {!finished && blockers && task.status === "em_andamento" && <p className="text-xs text-destructive">{blockers}</p>}
      <div className="flex flex-wrap gap-2">
        {task.status === "pendente" && <Button type="button" variant="outline" onClick={() => statusMut.mutate("em_andamento")} disabled={statusMut.isPending}><Play className="size-4" />Iniciar</Button>}
        {!finished && <Button type="button" onClick={() => statusMut.mutate("concluida")} disabled={statusMut.isPending || !!blockers}><CheckCircle2 className="size-4" />Concluir</Button>}
        {finished && <Button type="button" variant="outline" onClick={() => statusMut.mutate("pendente")} disabled={statusMut.isPending}><RotateCcw className="size-4" />Reabrir</Button>}
      </div>
    </section>
  </div>;
}
