import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, SlidersHorizontal, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CleaningStayContext } from "./CleaningStayContext";
import { RoutineSheetIndicators } from "./RoutineIndicators";
import { saveOpTask, deleteOpTask, scheduleCleaning } from "@/lib/api/core-client";
import { BrazilianDateInput, BrazilianTimeInput } from "@/components/ui/brazilian-date-input";
import { formatCalendarDate } from "@/lib/local-date";
import { Textarea } from "@/components/ui/textarea";
import { OpTaskExecution } from "@/components/admin/OpTaskExecution";
import { pendingSaveScopes } from "@/lib/op-save-state";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import {
  type BoardTask, type OpTaskInput, opKindLabel, opPropertiesQuery, opStatusLabel,
} from "@/lib/api/op-tasks";

const empty = (date: string): OpTaskInput => ({ title: "", kind: "limpeza", implementationId: null, dueDate: date, scheduledTime: null, priority: "media", status: "pendente", amount: null, responsibleName: null, guidance: null });

export function OpTaskDialog({ open, onOpenChange, task, defaultDate }: { open: boolean; onOpenChange: (v: boolean) => void; task?: BoardTask | null; defaultDate: string }) {
  const qc = useQueryClient();
  const props = useQuery({ ...opPropertiesQuery(), enabled: open });
  const [form, setForm] = useState<OpTaskInput>(empty(defaultDate));
  const [amountText, setAmountText] = useState("");
  const [savedFormKey, setSavedFormKey] = useState("");
  const [teamState, setTeamState] = useState({ dirty: false, saving: false });
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialized = useRef<string | null>(null);
  const updateTeamState = useCallback((dirty: boolean, saving: boolean) => setTeamState({ dirty, saving }), []);
  const formKey = JSON.stringify({ form, amountText });
  const routineDirty = savedFormKey !== "" && savedFormKey !== formKey;
  const scopes = pendingSaveScopes(routineDirty, teamState.dirty);
  useEffect(() => {
    if (!open) { initialized.current = null; return; }
    const identity = task?.id ?? "new";
    if (initialized.current === identity) return;
    initialized.current = identity;
    setTeamState({ dirty: false, saving: false }); setDiscardOpen(false);
    let initial = empty(defaultDate);
    let amount = "";
    if (task) {
      initial = { title: task.title, kind: task.kind as OpTaskInput["kind"], implementationId: task.implementationId ?? null, dueDate: task.dueDate ?? defaultDate, scheduledTime: task.scheduledTime, priority: (task.priority ?? "media") as OpTaskInput["priority"], status: task.status as OpTaskInput["status"], amount: task.totalAmount, responsibleName: task.responsibleName ?? null, guidance: task.guidance ?? null };
      amount = task.totalAmount == null ? "" : String(task.totalAmount).replace(".", ",");
    }
    setForm(initial); setAmountText(amount); setSavedFormKey(JSON.stringify({ form: initial, amountText: amount }));
  }, [open, task, defaultDate]);
  useEffect(() => {
    if (!open || !task) return;
    // Execution buttons save status immediately; never overwrite that status with the form's old snapshot.
    setForm((current) => ({ ...current, status: task.status as OpTaskInput["status"] }));
    setSavedFormKey((key) => {
      if (!key) return key;
      const snapshot = JSON.parse(key) as { form: OpTaskInput; amountText: string };
      return JSON.stringify({ ...snapshot, form: { ...snapshot.form, status: task.status } });
    });
  }, [open, task?.status]);
  const set = <K extends keyof OpTaskInput>(k: K, v: OpTaskInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const done = () => { for (const key of ["op-tasks", "op-movements", "op-cleaning"]) void qc.invalidateQueries({ queryKey: [key] }); onOpenChange(false); };
  const save = useMutation({
    mutationFn: async () => {
      const amount = amountText.trim() ? Number(amountText.replace(/\./g, "").replace(",", ".")) : null;
      if (task?.kind === "limpeza" && task.reservationId && form.dueDate !== task.dueDate) await scheduleCleaning(task.id, form.dueDate);
      return saveOpTask({ ...form, amount }, task?.id);
    },
    onSuccess: () => { toast.success(task ? "Rotina salva" : "Tarefa criada"); setSavedFormKey(formKey); if (!task) done(); else for (const key of ["op-tasks", "op-movements", "op-cleaning"]) void qc.invalidateQueries({ queryKey: [key] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({ mutationFn: () => { if (!task) throw new Error("Selecione a tarefa."); return deleteOpTask(task.id); }, onSuccess: () => { toast.success("Tarefa excluída"); done(); }, onError: (e: Error) => toast.error(e.message) });
  const label = "grid gap-1 text-xs font-medium text-muted-foreground";
  const input = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const busy = save.isPending || remove.isPending || teamState.saving;
  const requestClose = (value: boolean) => {
    if (value) { onOpenChange(true); return; }
    if (busy || discardOpen) return;
    if (scopes.length) setDiscardOpen(true);
    else onOpenChange(false);
  };

  return <Sheet open={open} onOpenChange={requestClose}>
    <SheetContent onInteractOutside={(e) => { if (discardOpen) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (discardOpen) e.preventDefault(); }} className="flex w-full flex-col gap-0 p-0 sm:w-[600px] sm:max-w-[600px] [&>button]:text-primary-foreground">
      <SheetHeader className="shrink-0 border-b border-border bg-primary px-5 py-6 text-left text-primary-foreground [&_h2]:text-primary-foreground"><p className="text-xs font-semibold uppercase">Rotina operacional</p><SheetTitle>{task ? task.title : "Nova rotina"}</SheetTitle><p className="text-sm">{task?.propertyName || "Selecione o imóvel"}</p>{task && <div className="space-y-2 pt-2"><RoutineSheetIndicators task={task} priority={form.priority} /><p className="text-xs">{form.dueDate ? formatCalendarDate(form.dueDate) : "Sem data"} {form.scheduledTime || ""}</p></div>}</SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <form id="op-task-form" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (!busy) save.mutate(); }}>
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-3">
        <p role="status" aria-live="polite" className={routineDirty ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{save.isPending ? "Salvando rotina…" : routineDirty ? "Rotina com alterações não salvas" : task ? "Rotina salva" : "Nova rotina ainda não salva"}</p>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-primary" />Agendamento</h3>
        <label className={label}>Imóvel<select disabled={!!task?.reservationId} className={input} value={form.implementationId ?? ""} onChange={(e) => set("implementationId", e.target.value || null)}><option value="">Sem imóvel</option>{(props.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Tipo<select disabled={!!task?.reservationId} className={input} value={form.kind} onChange={(e) => set("kind", e.target.value as OpTaskInput["kind"])}>{Object.entries(opKindLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className={label}>Horário previsto<BrazilianTimeInput aria-label="Horário previsto" className={input} value={form.scheduledTime ?? ""} onValueChange={(value) => set("scheduledTime", value || null)} /></label>
        </div>
        <label className={label}>Data da execução prevista<BrazilianDateInput required aria-label="Data da execução prevista" className={input} value={form.dueDate} onValueChange={(value) => set("dueDate", value)} /></label>
        {task?.kind === "limpeza" && <div className="my-2"><CleaningStayContext task={task} /></div>}
        <div className="mt-2 grid gap-3 border-t border-border pt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4 text-primary" />Planejamento da rotina</h3>
          <label className={label}>Valor total da rotina (R$)<input inputMode="decimal" className={`${input} h-12 text-lg font-semibold tabular-nums`} value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Não informado" /></label>
        </div>
        {!task && <label className={label}>Situação<select className={input} value={form.status} onChange={(e) => set("status", e.target.value as OpTaskInput["status"])}>{Object.entries(opStatusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
        <label className={`${label} mt-2`}>Observação ao profissional<Textarea aria-label="Observação ao profissional" rows={3} value={form.guidance ?? ""} onChange={(e) => set("guidance", e.target.value)} placeholder="Instruções para a equipe" /></label>
        <details open={!task ? true : undefined} className="mt-2 border-y border-border py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><SlidersHorizontal className="size-4 text-muted-foreground" />Mais detalhes</summary>
          <div className="mt-4 grid gap-3">
            <label className={label}>Título<input required className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Limpeza pré check-in" /></label>
            <label className={label}>Prioridade<select aria-label="Prioridade" className={input} value={form.priority} onChange={(e) => set("priority", e.target.value as OpTaskInput["priority"])}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></label>
            <label className={label}>Responsável de referência<input className={input} value={form.responsibleName ?? ""} onChange={(e) => set("responsibleName", e.target.value)} placeholder="Nome" /></label>
            {task && <div className="border-t border-border pt-3"><Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { if (confirm("Excluir esta tarefa?")) remove.mutate(); }}><Trash2 className="size-4" />Excluir rotina</Button></div>}
          </div>
        </details>
        </fieldset>
      </form>
      {task && <OpTaskExecution key={task.id} taskId={task.id} onSaveStateChange={updateTeamState} />}
      </div>
      <SheetFooter className="flex shrink-0 flex-col gap-2 border-t border-border bg-background p-4 sm:flex-row sm:flex-wrap sm:justify-end sm:space-x-0">
        <div role="status" aria-live="polite" className="w-full text-xs text-muted-foreground">{scopes.length ? `Alterações não salvas: ${scopes.join(" e ")}.` : task ? "Rotina e equipe sem alterações pendentes." : "Nova rotina ainda não salva."}</div>
        <Button variant="outline" className="min-h-11 w-full sm:min-h-10 sm:w-auto" disabled={busy} onClick={() => requestClose(false)}>Fechar</Button><Button type="submit" form="op-task-form" className="min-h-11 w-full sm:min-h-10 sm:w-auto" disabled={busy || (!!task && !routineDirty)}>{save.isPending ? "Salvando rotina…" : "Salvar rotina"}</Button>
      </SheetFooter>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Descartar alterações não salvas?</AlertDialogTitle><AlertDialogDescription>Há alterações pendentes na {scopes.join(" e na ")}. Apenas o que ainda não foi salvo será descartado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar editando</AlertDialogCancel><AlertDialogAction onClick={() => { setDiscardOpen(false); onOpenChange(false); }}>Descartar e fechar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </SheetContent>
  </Sheet>;
}
