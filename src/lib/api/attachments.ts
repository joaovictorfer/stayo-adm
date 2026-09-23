/**
 * Anexos/documentos do proprietário (Fase 17I) — Storage privado de
 * verdade (migration 0015), nunca um bucket público. Diferente do resto
 * do `AdminApiClient`: não existe adapter local aqui — armazenar um
 * arquivo de verdade em `localStorage` não é uma opção real (limite de
 * tamanho, sem persistência de binário), então esta vertical só existe
 * quando o Supabase está configurado. Sem isso, a UI mostra "não
 * disponível", mesmo princípio das telas de auth (`login.tsx`,
 * `portal.login.tsx`).
 *
 * Upload/download passam sempre pela API de Storage do supabase-js
 * (`.storage.from(...)`), nunca por um `insert`/`delete` cru em
 * `storage.objects` — o próprio Supabase bloqueia `delete` direto por
 * padrão (`storage.protect_delete()`, descoberto testando a migration
 * 0015 contra o banco real) exatamente para isso.
 */

import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase-client";

const BUCKET = "owner-attachments";

export interface Attachment {
  id: string;
  ownerId: string;
  implementationId: string | null;
  ownerTaskId: string | null;
  inspectionId: string | null;
  storagePath: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  uploadedBy: string | null;
  createdAt: string;
}

interface AttachmentRow {
  id: string;
  owner_id: string;
  implementation_id: string | null;
  owner_task_id: string | null;
  inspection_id: string | null;
  storage_path: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  filename: string;
  uploaded_by: string | null;
  created_at: string;
}

function attachmentFromRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    ownerId: row.owner_id,
    implementationId: row.implementation_id,
    ownerTaskId: row.owner_task_id,
    inspectionId: row.inspection_id,
    storagePath: row.storage_path,
    category: row.category,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    filename: row.filename,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export { isSupabaseConfigured as isAttachmentsAvailable };

export async function listOwnerAttachments(ownerId: string): Promise<Attachment[]> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");
  const { data, error } = await client
    .from("attachments")
    .select()
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<AttachmentRow[]>();
  if (error) throw error;
  return data.map(attachmentFromRow);
}

/**
 * Envia o arquivo para o Storage e grava o metadado numa única operação
 * lógica — se o `insert` falhar depois do upload, o arquivo órfão fica
 * no bucket (aceitável: nunca é servido sem uma linha em `attachments`
 * apontando pra ele, e a RLS de leitura do Storage já isola por pasta do
 * `owner_id`, então um órfão não vaza nada).
 */
export async function uploadOwnerAttachment(params: {
  ownerId: string;
  implementationId: string | null;
  ownerTaskId: string | null;
  category: string;
  file: File;
}): Promise<Attachment> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");

  const storagePath = `${params.ownerId}/${crypto.randomUUID()}-${params.file.name}`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, params.file);
  if (uploadError) throw uploadError;

  const {
    data: { user },
  } = await client.auth.getUser();

  const { data, error } = await client
    .from("attachments")
    .insert({
      owner_id: params.ownerId,
      implementation_id: params.implementationId,
      owner_task_id: params.ownerTaskId,
      storage_path: storagePath,
      category: params.category,
      mime_type: params.file.type || "application/octet-stream",
      size_bytes: params.file.size,
      filename: params.file.name,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single<AttachmentRow>();
  if (error) throw error;
  return attachmentFromRow(data);
}

/** URL assinada e temporária — o bucket nunca é público, nunca serve um caminho direto. */
export async function getAttachmentSignedUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Sempre pela API de Storage — `delete` cru em `storage.objects` é bloqueado pelo próprio Supabase. */
export async function deleteOwnerAttachment(id: string, storagePath: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");
  const { error: storageError } = await client.storage.from(BUCKET).remove([storagePath]);
  if (storageError) throw storageError;
  const { error } = await client.from("attachments").delete().eq("id", id);
  if (error) throw error;
}
