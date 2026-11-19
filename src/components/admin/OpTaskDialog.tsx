import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CleaningStayContext } from "./CleaningStayContext";
import { RoutineSheetIndicators } from "./RoutineIndicators";
import { saveOpTask, deleteOpTask, scheduleCleaning } from "@/lib/api/core-client";
import { Textarea } from "@/components/ui/textarea";
import { OpTaskExecution } from "@/components/admin/OpTaskExecution";
import {
  type BoardTask, type OpTaskInput, opKindLabel, opPropertiesQuery, opStatusLabel,
} from "@/lib/api/op-tasks";

const empty = (date: string): OpTaskInput => ({ title: "", kind: "limpeza", implementationId: null, dueDate: date, scheduledTime: null, priority: "media", status: "pendente", amount: null, responsibleName: null, guidance: null });

export function OpTaskDialog({ open, onOpenChange, task, defaultDate }: { open: boolean; onOpenChange: (v: boolean) => void; task?: BoardTask | null; defaultDate: string }) {
  const qc = useQueryClient();
  const props = useQuery({ ...opPropertiesQuery(), enabled: open });
  const [form, setForm] = useState<OpTaskInput>(empty(defaultDate));
  const [amountText, setAmountText] = useState("");
  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({ title: task.title, kind: task.kind as OpTaskInput["kind"], implementationId: task.implementationId ?? null, dueDate: task.dueDate ?? defaultDate, scheduledTime: task.scheduledTime, priority: (task.priority ?? "media") as OpTaskInput["priority"], status: task.status as OpTaskInput["status"], amount: task.totalAmount, responsibleName: task.responsibleName ?? null, guidance: task.guidance ?? null });
      setAmountText(task.totalAmount == null ? "" : String(task.totalAmount).replace(".", ","));
    } else { setForm(empty(defaultDate)); setAmountText(""); }
  }, [open, task, defaultDate]);
  const set = <K extends keyof OpTaskInput>(k: K, v: OpTaskInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const done = () => { for (const key of ["op-tasks", "op-movements", "op-cleaning"]) void qc.invalidateQueries({ queryKey: [key] }); onOpenChange(false); };
  const save = useMutation({
    mutationFn: async () => {
      const amount = amountText.trim() ? Number(amountText.replace(/\./g, "").replace(",", ".")) : null;
      if (task?.kind === "limpeza" && task.reservationId && form.dueDate !== task.dueDate) await scheduleCleaning(task.id, form.dueDate);
      return saveOpTask({ ...form, amount }, task?.id);
    },
    onSuccess: () => { toast.success(task ? "Tarefa atualizada" : "Tarefa criada"); done(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({ mutationFn: () => { if (!task) throw new Error("Selecione a tarefa."); return deleteOpTask(task.id); }, onSuccess: () => { toast.success("Tarefa excluída"); done(); }, onError: (e: Error) => toast.error(e.message) });
  const label = "grid gap-1 text-xs font-medium text-muted-foreground";
  const input = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="flex w-full flex-col gap-0 p-0 sm:w-[600px] sm:max-w-[600px]">
      <SheetHeader className="shrink-0 border-b border-border bg-primary px-5 py-6 text-left text-primary-foreground [&_h2]:text-primary-foreground"><p className="text-xs font-semibold uppercase">Rotina operacional</p><SheetTitle>{task ? task.title : "Nova rotina"}</SheetTitle><p className="text-sm">{task?.propertyName || "Selecione o imóvel"}</p>{task && <div className="space-y-2 pt-2"><RoutineSheetIndicators task={task} priority={form.priority} /><p className="text-xs">{form.dueDate ? `${form.dueDate.slice(8,10)}/${form.dueDate.slice(5,7)}/${form.dueDate.slice(0,4)}` : "Sem data"} {form.scheduledTime || ""}</p></div>}</SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      {task?.kind === "limpeza" && <CleaningStayContext task={task} />}
      <form id="op-task-form" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <label className={label}>Título<input required className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Limpeza pré check-in" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Tipo<select disabled={!!task?.reservationId} className={input} value={form.kind} onChange={(e) => set("kind", e.target.value as OpTaskInput["kind"])}>{Object.entries(opKindLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className={label}>Prioridade<select aria-label="Prioridade" className={input} value={form.priority} onChange={(e) => set("priority", e.target.value as OpTaskInput["priority"])}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></label>
        </div>
        <label className={label}>Imóvel<select disabled={!!task?.reservationId} className={input} value={form.implementationId ?? ""} onChange={(e) => set("implementationId", e.target.value || null)}><option value="">Sem imóvel</option>{(props.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Data<input required type="date" className={input} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></label>
          <label className={label}>Horário<input type="time" className={input} value={form.scheduledTime ?? ""} onChange={(e) => set("scheduledTime", e.target.value || null)} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Responsável<input className={input} value={form.responsibleName ?? ""} onChange={(e) => set("responsibleName", e.target.value)} placeholder="Nome" /></label>
          <label className={label}>Valor (R$)<input inputMode="decimal" className={input} value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0,00" /></label>
        </div>
        {!task && <label className={label}>Situação<select className={input} value={form.status} onChange={(e) => set("status", e.target.value as OpTaskInput["status"])}>{Object.entries(opStatusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
        <label className={label}>Orientação<Textarea rows={3} value={form.guidance ?? ""} onChange={(e) => set("guidance", e.target.value)} placeholder="Instruções para a equipe" /></label>
      </form>
      {task && <OpTaskExecution taskId={task.id} />}
      </div>
      <SheetFooter className="shrink-0 gap-2 border-t border-border bg-background p-4 sm:justify-between">
        {task ? <Button type="button" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => { if (confirm("Excluir esta tarefa?")) remove.mutate(); }}>Excluir</Button> : <span />}
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" form="op-task-form" disabled={save.isPending}>{save.isPending ? "Salvando…" : task ? "Salvar alterações" : "Salvar"}</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>;
}
