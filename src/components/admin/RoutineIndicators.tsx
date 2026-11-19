import { AlertTriangle, Flag, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AdminStatusBadge } from "./AdminPrimitives";
import { opTasksQuery, type BoardTask } from "@/lib/api/op-tasks";
import { localISODate } from "@/lib/local-date";

export function RoutineIndicators({ task, priority = task.priority }: { task: BoardTask; priority?: string | null }) {
  const finished = /conclu|feito|done|cancel/i.test(task.status);
  const status = /cancel/i.test(task.status) ? "Cancelada" : finished ? "Concluída" : task.status === "em_andamento" ? "Em andamento" : task.responsibleName ? "Atribuída" : "Pendente";
  const late = !finished && !!task.dueDate && task.dueDate.slice(0, 10) < localISODate();
  return <span className="flex flex-wrap items-center gap-1.5" aria-label="Indicadores da rotina">
    <AdminStatusBadge tone={/cancel/i.test(task.status) ? "neutral" : finished ? "success" : status === "Pendente" ? "neutral" : "info"}><span className="mr-1 inline-block size-1.5 rounded-full bg-current" />{status}</AdminStatusBadge>
    <AdminStatusBadge tone={priority === "alta" ? "warning" : priority === "baixa" ? "neutral" : "info"}><Flag className="mr-1 inline size-3" />Prioridade: {priority === "alta" ? "Alta" : priority === "baixa" ? "Baixa" : "Média"}</AdminStatusBadge>
    {late && <AdminStatusBadge tone="danger"><AlertTriangle className="mr-1 inline size-3" />Atrasada</AdminStatusBadge>}
  </span>;
}

export function RoutineSheetIndicators({ task, priority }: { task: BoardTask; priority: string }) {
  const data = useQuery(opTasksQuery());
  const current = data.data?.find((t) => t.id === task.id) ?? task;
  return <div className="space-y-2"><RoutineIndicators task={current} priority={priority} />{current.responsibleName && <p className="flex items-center gap-1.5 text-xs"><UsersRound className="size-3.5 shrink-0" />{current.responsibleName}</p>}</div>;
}