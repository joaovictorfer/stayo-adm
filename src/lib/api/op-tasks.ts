import { queryOptions } from "@tanstack/react-query";

import { supabase } from "../../integrations/supabase/client";
import type { OperationTask } from "../../types/core";

/** Tarefas operacionais guardadas no próprio Admin (Fase 2). O STAYO APP segue lido em paralelo, sem importação. */
export type OpTaskKind = "limpeza" | "vistoria" | "manutencao" | "checkin" | "checkout" | "outro";
export type OpTaskStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
export type OpTaskPriority = "baixa" | "media" | "alta";

export interface OpTaskInput {
  title: string;
  kind: OpTaskKind;
  implementationId: string | null;
  dueDate: string;
  scheduledTime: string | null;
  priority: OpTaskPriority;
  status: OpTaskStatus;
  amount: number | null;
  responsibleName: string | null;
  guidance: string | null;
}

export type BoardTask = OperationTask & { source: "admin" | "core"; guidance?: string | null; responsibleName?: string | null; implementationId?: string | null };

export const opKindLabel: Record<OpTaskKind, string> = { limpeza: "Limpeza", vistoria: "Vistoria", manutencao: "Manutenção", checkin: "Check-in", checkout: "Check-out", outro: "Outro" };
export const opStatusLabel: Record<OpTaskStatus, string> = { pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };

/** Valida entrada antes de gravar; retorna mensagem em pt-BR ou null. */
export function validateOpTask(input: OpTaskInput): string | null {
  if (!input.title.trim()) return "Informe o título da tarefa.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return "Informe a data.";
  if (input.scheduledTime && !/^\d{2}:\d{2}$/.test(input.scheduledTime)) return "Horário inválido.";
  if (input.amount != null && (!Number.isFinite(input.amount) || input.amount < 0)) return "Valor inválido.";
  return null;
}

const propertyLabel = (p: { code: string; nickname: string | null; condominium_name: string | null; unit: string | null } | null) =>
  p ? (p.nickname || [p.condominium_name, p.unit].filter(Boolean).join(" ") || p.code) : null;

async function listOpTasks(): Promise<BoardTask[]> {
  const { data, error } = await supabase.from("op_tasks")
    .select("*, implementation_projects(code, nickname, condominium_name, unit)")
    .order("due_date").order("scheduled_time");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, source: "admin", title: r.title, kind: r.kind,
    propertyId: r.implementation_id, implementationId: r.implementation_id,
    propertyName: propertyLabel(r.implementation_projects as never),
    reservationId: null, reservationCode: null, dueDate: r.due_date,
    scheduledTime: r.scheduled_time ? r.scheduled_time.slice(0, 5) : null,
    responsibleUserId: r.responsible_name ? "admin" : null, responsibleName: r.responsible_name,
    status: r.status, priority: r.priority, totalAmount: r.amount == null ? null : Number(r.amount),
    assignments: [], guidance: r.guidance, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

export const opTasksQuery = () => queryOptions({ queryKey: ["op-tasks"], queryFn: listOpTasks });

export const opPropertiesQuery = () => queryOptions({
  queryKey: ["op-tasks", "properties"],
  queryFn: async () => {
    const { data, error } = await supabase.from("implementation_projects").select("id, code, nickname, condominium_name, unit").order("code");
    if (error) throw error;
    return (data ?? []).map((p) => ({ id: p.id, label: `${propertyLabel(p)} · ${p.code}` }));
  },
});

export async function saveOpTask(input: OpTaskInput, id?: string) {
  const problem = validateOpTask(input);
  if (problem) throw new Error(problem);
  const row = {
    title: input.title.trim(), kind: input.kind, implementation_id: input.implementationId,
    due_date: input.dueDate, scheduled_time: input.scheduledTime || null, priority: input.priority,
    status: input.status, amount: input.amount, responsible_name: input.responsibleName?.trim() || null,
    guidance: input.guidance?.trim() || null,
  };
  // Na edição, a situação muda só pela execução (Iniciar/Concluir), evitando sobrescrever o andamento.
  const { status: _status, ...editRow } = row;
  const q = id ? supabase.from("op_tasks").update(editRow).eq("id", id) : supabase.from("op_tasks").insert(row);
  const { error } = await q;
  if (error) throw new Error(error.code === "42501" ? "Seu perfil não pode alterar tarefas." : "Não foi possível salvar a tarefa.");
}

export async function setOpTaskStatus(id: string, status: OpTaskStatus) {
  const { error } = await supabase.from("op_tasks").update({ status }).eq("id", id);
  if (error) throw new Error("Não foi possível atualizar a situação.");
}

export async function deleteOpTask(id: string) {
  const { error } = await supabase.from("op_tasks").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir a tarefa.");
}
