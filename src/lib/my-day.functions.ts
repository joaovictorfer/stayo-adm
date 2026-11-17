import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Meu Dia (link do prestador, sem login). O token é validado no banco a cada chamada
 * e toda leitura/escrita é restrita às tarefas em que a pessoa está na equipe.
 */
const tokenSchema = z.string().min(20).max(120);

async function ctx(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("op_staff_link_ctx", { p_token: token });
  if (error || !data) throw new Error("Link inválido ou expirado");
  return { admin: supabaseAdmin, staffId: data as string };
}
async function assertTask(admin: Awaited<ReturnType<typeof ctx>>["admin"], staffId: string, taskId: string) {
  const { data } = await admin.from("op_task_team").select("id").eq("task_id", taskId).eq("staff_id", staffId).maybeSingle();
  if (!data) throw new Error("Tarefa não encontrada");
}

export const getMyDay = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { admin, staffId } = await ctx(data.token);
    const { data: staff } = await admin.from("op_staff").select("name").eq("id", staffId).single();
    const { data: links } = await admin.from("op_task_team").select("task_id").eq("staff_id", staffId);
    const ids = (links ?? []).map((l) => l.task_id);
    if (!ids.length) return { name: staff?.name ?? "", tasks: [] };
    const { data: tasks } = await admin.from("op_tasks")
      .select("id, title, kind, due_date, scheduled_time, status, guidance, started_at, completed_at, implementation_projects(code, nickname, condominium_name, unit, address)")
      .in("id", ids).neq("status", "cancelada").gte("due_date", data.from).lte("due_date", data.to)
      .order("due_date").order("scheduled_time");
    const taskIds = (tasks ?? []).map((t) => t.id);
    const { data: items } = taskIds.length
      ? await admin.from("op_task_checklist").select("id, task_id, area, label, requires_photo, sort_order, checked_at, photo_path").in("task_id", taskIds).order("sort_order")
      : { data: [] };
    const paths = (items ?? []).map((i) => i.photo_path).filter(Boolean) as string[];
    const signed = paths.length ? (await admin.storage.from("op-task-photos").createSignedUrls(paths, 3600)).data ?? [] : [];
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return {
      name: staff?.name ?? "",
      tasks: (tasks ?? []).map((t) => {
        const p = t.implementation_projects as { code: string; nickname: string | null; condominium_name: string | null; unit: string | null; address: string | null } | null;
        return {
          id: t.id, title: t.title, kind: t.kind, dueDate: t.due_date, time: t.scheduled_time?.slice(0, 5) ?? null, status: t.status,
          guidance: t.guidance, startedAt: t.started_at, completedAt: t.completed_at,
          property: p ? (p.nickname || [p.condominium_name, p.unit].filter(Boolean).join(" ") || p.code) : null, address: p?.address ?? null,
          items: (items ?? []).filter((i) => i.task_id === t.id).map((i) => ({ id: i.id, area: i.area, label: i.label, requires_photo: i.requires_photo, checked_at: i.checked_at, photo_path: i.photo_path, photoUrl: i.photo_path ? urls.get(i.photo_path) ?? null : null })),
        };
      }),
    };
  });

export const setMyTaskStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, taskId: z.string().uuid(), status: z.enum(["em_andamento", "concluida"]) }).parse(d))
  .handler(async ({ data }) => {
    const { admin, staffId } = await ctx(data.token);
    await assertTask(admin, staffId, data.taskId);
    const { data: updated, error } = await admin.from("op_tasks").update({ status: data.status }).eq("id", data.taskId).not("status", "in", "(cancelada,concluida)").select("id");
    if (error) throw new Error(error.message.includes("checklist_incompleto") ? "Conclua o checklist e as fotos obrigatórias." : "Não foi possível atualizar a tarefa.");
    if (!updated?.length) throw new Error("Esta tarefa já foi finalizada e não pode ser reaberta pelo Meu Dia.");
    return { ok: true };
  });

async function itemTask(admin: Awaited<ReturnType<typeof ctx>>["admin"], staffId: string, itemId: string) {
  const { data } = await admin.from("op_task_checklist").select("task_id").eq("id", itemId).maybeSingle();
  if (!data) throw new Error("Item não encontrado");
  await assertTask(admin, staffId, data.task_id);
  const { data: t } = await admin.from("op_tasks").select("status").eq("id", data.task_id).single();
  if (t?.status === "concluida" || t?.status === "cancelada") throw new Error("Tarefa já finalizada");
  return data.task_id;
}

export const checkMyItem = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, itemId: z.string().uuid(), checked: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { admin, staffId } = await ctx(data.token);
    await itemTask(admin, staffId, data.itemId);
    const { data: staff } = await admin.from("op_staff").select("name").eq("id", staffId).single();
    const { error } = await admin.from("op_task_checklist").update({ checked_at: data.checked ? new Date().toISOString() : null, checked_by: data.checked ? staff?.name ?? "Meu Dia" : null }).eq("id", data.itemId);
    if (error) throw new Error("Não foi possível marcar o item");
    return { ok: true };
  });

export const uploadMyPhoto = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, itemId: z.string().uuid(), base64: z.string().min(100).max(9_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { admin, staffId } = await ctx(data.token);
    const taskId = await itemTask(admin, staffId, data.itemId);
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const path = `${taskId}/${data.itemId}/${crypto.randomUUID()}.jpg`;
    const up = await admin.storage.from("op-task-photos").upload(path, bin, { contentType: "image/jpeg" });
    if (up.error) throw new Error("Não foi possível enviar a foto");
    await admin.from("op_task_checklist").update({ photo_path: path }).eq("id", data.itemId);
    return { ok: true };
  });
