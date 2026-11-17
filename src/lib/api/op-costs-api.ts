import { queryOptions } from "@tanstack/react-query";

import { supabase } from "../../integrations/supabase/client";
import { base64ToBlob } from "../image-compress";
import type { CostExpense, CostTask } from "../op-costs";

const label = (p: { code: string; nickname: string | null; condominium_name: string | null; unit: string | null } | null) =>
  p ? (p.nickname || [p.condominium_name, p.unit].filter(Boolean).join(" ") || p.code) : null;
const PROJ = "implementation_projects(code, nickname, condominium_name, unit)";
const range = (month: string) => { const [y, m] = month.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`] as const; };

export type ExpenseRow = CostExpense & { description: string; category: string; taskId: string | null; receiptUrl: string | null };

export const opCostsQuery = (month: string) => queryOptions({
  queryKey: ["op-costs", month],
  queryFn: async () => {
    const [from, to] = range(month);
    const [t, e] = await Promise.all([
      supabase.from("op_tasks").select(`id, title, due_date, status, amount, implementation_id, ${PROJ}, op_task_team(staff_id, share, op_staff(name))`).gte("due_date", from).lte("due_date", to),
      supabase.from("op_expenses").select(`*, ${PROJ}, op_staff(name)`).gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false }),
    ]);
    if (t.error) throw t.error; if (e.error) throw e.error;
    const tasks: CostTask[] = (t.data ?? []).map((r) => ({
      id: r.id, title: r.title, dueDate: r.due_date, status: r.status, amount: r.amount == null ? null : Number(r.amount),
      propertyId: r.implementation_id, propertyName: label(r.implementation_projects as never),
      team: ((r.op_task_team ?? []) as { staff_id: string; share: number; op_staff: { name: string } | null }[]).map((m) => ({ staffId: m.staff_id, name: m.op_staff?.name ?? "—", share: Number(m.share) })),
    }));
    const paths = (e.data ?? []).map((r) => r.receipt_path).filter(Boolean) as string[];
    const signed = paths.length ? (await supabase.storage.from("op-task-photos").createSignedUrls(paths, 3600)).data ?? [] : [];
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    const expenses: ExpenseRow[] = (e.data ?? []).map((r) => ({
      id: r.id, date: r.expense_date, amount: Number(r.amount), status: r.status as ExpenseRow["status"], description: r.description, category: r.category,
      propertyId: r.implementation_id, propertyName: label(r.implementation_projects as never), staffId: r.staff_id,
      staffName: (r.op_staff as { name: string } | null)?.name ?? null, taskId: r.task_id, receiptUrl: r.receipt_path ? urls.get(r.receipt_path) ?? null : null,
    }));
    return { tasks, expenses };
  },
});

const fail = (e: { code?: string } | null, msg: string) => { if (e) throw new Error(e.code === "42501" ? "Seu perfil não pode alterar custos." : msg); };

export async function createExpense(input: { date: string; implementationId: string | null; staffId: string | null; category: string; description: string; amount: number; receiptBase64: string | null }) {
  if (!input.description.trim()) throw new Error("Descreva o gasto.");
  if (!(input.amount > 0)) throw new Error("Informe um valor maior que zero.");
  let receipt_path: string | null = null;
  if (input.receiptBase64) {
    receipt_path = `expenses/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from("op-task-photos").upload(receipt_path, base64ToBlob(input.receiptBase64), { contentType: "image/jpeg" });
    if (up.error) throw new Error("Não foi possível enviar o comprovante.");
  }
  const { error } = await supabase.from("op_expenses").insert({ expense_date: input.date, implementation_id: input.implementationId, staff_id: input.staffId, category: input.category, description: input.description.trim(), amount: input.amount, receipt_path });
  fail(error, "Não foi possível registrar o gasto.");
}
export async function setExpenseStatus(id: string, status: "pendente" | "aprovado" | "pago" | "recusado") {
  const { error } = await supabase.from("op_expenses").update({ status }).eq("id", id);
  fail(error, "Não foi possível atualizar.");
}
export async function deleteExpense(id: string) {
  const { error } = await supabase.from("op_expenses").delete().eq("id", id);
  fail(error, "Não foi possível excluir.");
}
