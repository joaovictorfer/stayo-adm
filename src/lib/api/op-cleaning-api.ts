import { queryOptions } from "@tanstack/react-query";

import { supabase } from "../../integrations/supabase/client";
import { addDaysISO } from "../local-date";
import { cleaningStatus, type CleaningStatus } from "../op-cleaning";
import { propertyLabel } from "../property-label";
import { saveTeam } from "./op-execution";

export type CleaningRoutine = { id: string; implementationId: string; property: string; dueDate: string; status: string; amount: number | null; staffId: string | null; staffName: string | null; fromReservation: boolean };
export type CleaningRow = { id: string; code: string; property: string; status: CleaningStatus; next: CleaningRoutine | null };

/** Painel de limpeza: imóveis em operação, reservas importadas e limpezas do Admin. */
export const cleaningBoardQuery = (today: string) => queryOptions({
  queryKey: ["op-cleaning", today],
  queryFn: async () => {
    const [props, res, tasks] = await Promise.all([
      supabase.from("implementation_projects").select("id, code, nickname, condominium_name, unit").eq("operational_status", "operacao").order("code"),
      supabase.from("payout_reservations").select("implementation_id, checkin_date, checkout_date").gte("checkout_date", addDaysISO(today, -180)),
      supabase.from("op_tasks").select("id, implementation_id, due_date, status, amount, responsible_name, payout_reservation_id, op_task_team(staff_id, op_staff(name))").eq("kind", "limpeza").gte("due_date", addDaysISO(today, -180)).order("due_date"),
    ]);
    for (const r of [props, res, tasks]) if (r.error) throw r.error;
    const names = new Map((props.data ?? []).map((p) => [p.id, propertyLabel(p)]));
    const routines: CleaningRoutine[] = (tasks.data ?? []).filter((t) => t.implementation_id).map((t) => {
      const team = (t.op_task_team ?? []) as unknown as { staff_id: string; op_staff: { name: string } | null }[];
      return { id: t.id, implementationId: t.implementation_id!, property: names.get(t.implementation_id!) ?? "Imóvel", dueDate: t.due_date, status: t.status,
        amount: t.amount == null ? null : Number(t.amount), staffId: team[0]?.staff_id ?? null, staffName: team[0]?.op_staff?.name ?? t.responsible_name, fromReservation: !!t.payout_reservation_id };
    });
    const rows: CleaningRow[] = (props.data ?? []).map((p) => {
      const mine = routines.filter((r) => r.implementationId === p.id);
      const reservations = (res.data ?? []).filter((r) => r.implementation_id === p.id && r.checkin_date && r.checkout_date).map((r) => ({ checkin: r.checkin_date!, checkout: r.checkout_date! }));
      return { id: p.id, code: p.code, property: names.get(p.id)!, status: cleaningStatus(reservations, mine.map((t) => ({ dueDate: t.dueDate, status: t.status })), today),
        next: mine.find((t) => t.status === "pendente" || t.status === "em_andamento") ?? null };
    });
    const open = routines.filter((r) => (r.status === "pendente" || r.status === "em_andamento") && names.has(r.implementationId));
    return { rows, open };
  },
});

const fail = (e: { code?: string; message?: string } | null) => {
  if (!e) return;
  if (e.code === "42501") throw new Error("Seu perfil não pode alterar a limpeza.");
  if (e.message?.includes("checklist_incompleto")) throw new Error("Esta limpeza tem checklist em aberto; conclua pela tarefa.");
  throw new Error("Não foi possível salvar a limpeza.");
};

/** Marca o imóvel como limpo: conclui a limpeza pendente mais recente até a data (ou cria uma), com quem limpou e o valor. */
export async function markClean(input: { implementationId: string; staffId: string; staffName: string; date: string; amount: number }) {
  if (!input.staffId) throw new Error("Informe quem limpou.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Informe a data da limpeza.");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("Informe um valor válido.");
  const { data: pending, error: e1 } = await supabase.from("op_tasks").select("id").eq("implementation_id", input.implementationId).eq("kind", "limpeza")
    .in("status", ["pendente", "em_andamento"]).lte("due_date", input.date).order("due_date", { ascending: false }).limit(1);
  fail(e1);
  const patch = { status: "concluida", due_date: input.date, amount: input.amount, responsible_name: input.staffName };
  let id = pending?.[0]?.id as string | undefined;
  if (id) { const { error } = await supabase.from("op_tasks").update(patch).eq("id", id); fail(error); }
  else {
    const { data, error } = await supabase.from("op_tasks").insert({ ...patch, title: "Limpeza", kind: "limpeza", implementation_id: input.implementationId, priority: "media" }).select("id").single();
    fail(error); id = data!.id;
  }
  await saveTeam(id!, [{ staff_id: input.staffId, share: 100, is_lead: true }]);
}

/** Marca o imóvel como sujo: cria uma limpeza pendente para hoje. */
export async function markDirty(implementationId: string, date: string) {
  const { error } = await supabase.from("op_tasks").insert({ title: "Limpeza solicitada", kind: "limpeza", implementation_id: implementationId, due_date: date, priority: "alta", status: "pendente" });
  fail(error);
}

/** Vincula o profissional a uma rotina de limpeza. */
export async function assignRoutine(taskId: string, staffId: string, staffName: string) {
  await saveTeam(taskId, staffId ? [{ staff_id: staffId, share: 100, is_lead: true }] : []);
  const { error } = await supabase.from("op_tasks").update({ responsible_name: staffId ? staffName : null }).eq("id", taskId);
  fail(error);
}
