import { queryOptions } from "@tanstack/react-query";

import { supabase } from "../../integrations/supabase/client";
import { base64ToBlob } from "../image-compress";
import { blockerMessage, validateTeam } from "../op-execution-rules";

/** Execução operacional no Admin (Fase 3): equipe, checklist, fotos, início e conclusão. */
const fail = (e: { code?: string; message?: string } | null, msg: string) => {
  if (!e) return;
  if (e.code === "42501") throw new Error("Seu perfil não pode fazer esta alteração.");
  if (e.message?.includes("checklist_incompleto")) throw new Error("Conclua o checklist e as fotos obrigatórias antes de finalizar.");
  throw new Error(msg);
};

export const opStaffQuery = () => queryOptions({
  queryKey: ["op-staff"],
  queryFn: async () => {
    const [{ data, error }, links] = await Promise.all([
      supabase.from("op_staff").select("*").order("name"),
      supabase.from("op_staff_links").select("staff_id, expires_at, revoked_at, created_at").is("revoked_at", null),
    ]);
    if (error) throw error;
    const active = new Map((links.data ?? []).filter((l) => new Date(l.expires_at) > new Date()).map((l) => [l.staff_id, l.expires_at]));
    return (data ?? []).map((s) => ({ ...s, linkExpiresAt: active.get(s.id) ?? null }));
  },
});

export async function saveStaff(input: { name: string; phone: string | null }, id?: string) {
  if (!input.name.trim()) throw new Error("Informe o nome.");
  const row = { name: input.name.trim(), phone: input.phone?.trim() || null };
  const { error } = id ? await supabase.from("op_staff").update(row).eq("id", id) : await supabase.from("op_staff").insert(row);
  fail(error, "Não foi possível salvar.");
}
export async function setStaffActive(id: string, active: boolean) {
  const { error } = await supabase.from("op_staff").update({ active }).eq("id", id);
  fail(error, "Não foi possível atualizar.");
  if (!active) await supabase.rpc("admin_revoke_staff_links", { p_staff_id: id });
}
export async function createStaffLink(staffId: string) {
  const { data, error } = await supabase.rpc("admin_create_staff_link", { p_staff_id: staffId });
  fail(error, "Não foi possível gerar o link.");
  return `${window.location.origin}/meu-dia/${data as string}`;
}
export async function revokeStaffLinks(staffId: string) {
  const { error } = await supabase.rpc("admin_revoke_staff_links", { p_staff_id: staffId });
  fail(error, "Não foi possível revogar.");
}

export const opTemplatesQuery = () => queryOptions({
  queryKey: ["op-checklists", "active"],
  queryFn: async () => {
    const { data, error } = await supabase.from("op_checklist_templates").select("id, name, task_type").eq("is_active", true).order("name");
    if (error) throw error; return data ?? [];
  },
});

export const opExecutionQuery = (taskId: string) => queryOptions({
  queryKey: ["op-tasks", "execution", taskId],
  queryFn: async () => {
    const [task, team, items] = await Promise.all([
      supabase.from("op_tasks").select("id, status, started_at, completed_at, checklist_template_id").eq("id", taskId).single(),
      supabase.from("op_task_team").select("id, staff_id, share, is_lead, op_staff(name)").eq("task_id", taskId),
      supabase.from("op_task_checklist").select("*").eq("task_id", taskId).order("sort_order"),
    ]);
    if (task.error) throw task.error;
    const list = items.data ?? [];
    const paths = list.map((i) => i.photo_path).filter(Boolean) as string[];
    const signed = paths.length ? (await supabase.storage.from("op-task-photos").createSignedUrls(paths, 3600)).data ?? [] : [];
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return {
      task: task.data,
      team: (team.data ?? []).map((m) => ({ staff_id: m.staff_id, share: Number(m.share), is_lead: m.is_lead, name: (m.op_staff as { name: string } | null)?.name ?? "" })),
      items: list.map((i) => ({ ...i, photoUrl: i.photo_path ? urls.get(i.photo_path) ?? null : null })),
    };
  },
});

export async function saveTeam(taskId: string, team: { staff_id: string; share: number; is_lead: boolean }[]) {
  const problem = validateTeam(team); if (problem) throw new Error(problem);
  const del = await supabase.from("op_task_team").delete().eq("task_id", taskId);
  fail(del.error, "Não foi possível salvar a equipe.");
  if (team.length) { const { error } = await supabase.from("op_task_team").insert(team.map((m) => ({ ...m, task_id: taskId }))); fail(error, "Não foi possível salvar a equipe."); }
}

/** Troca o modelo do checklist; recusa se algum item já foi marcado, para não perder execução. */
export async function applyTemplate(taskId: string, templateId: string | null, hasProgress: boolean) {
  if (hasProgress) throw new Error("O checklist já tem itens marcados; não é possível trocar o modelo.");
  const del = await supabase.from("op_task_checklist").delete().eq("task_id", taskId);
  fail(del.error, "Não foi possível trocar o checklist.");
  await supabase.from("op_tasks").update({ checklist_template_id: templateId }).eq("id", taskId);
  if (!templateId) return;
  const { data, error } = await supabase.from("op_checklist_template_items").select("area, label, requires_photo, sort_order").eq("template_id", templateId).order("sort_order");
  fail(error, "Não foi possível ler o modelo.");
  if (data?.length) { const ins = await supabase.from("op_task_checklist").insert(data.map((d) => ({ ...d, task_id: taskId }))); fail(ins.error, "Não foi possível copiar o checklist."); }
}

export async function toggleItem(itemId: string, checked: boolean, by: string) {
  const { error } = await supabase.from("op_task_checklist").update({ checked_at: checked ? new Date().toISOString() : null, checked_by: checked ? by : null }).eq("id", itemId);
  fail(error, "Não foi possível marcar o item.");
}
export async function uploadItemPhoto(taskId: string, itemId: string, base64: string) {
  const path = `${taskId}/${itemId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from("op-task-photos").upload(path, base64ToBlob(base64), { contentType: "image/jpeg" });
  if (up.error) throw new Error("Não foi possível enviar a foto.");
  const { error } = await supabase.from("op_task_checklist").update({ photo_path: path }).eq("id", itemId);
  fail(error, "Não foi possível registrar a foto.");
}
export async function setTaskStatus(taskId: string, status: "em_andamento" | "concluida" | "pendente", items: { checked_at: string | null; requires_photo: boolean; photo_path: string | null }[]) {
  if (status === "concluida") { const m = blockerMessage(items); if (m) throw new Error(m); }
  const { error } = await supabase.from("op_tasks").update({ status }).eq("id", taskId);
  fail(error, "Não foi possível atualizar a tarefa.");
}
