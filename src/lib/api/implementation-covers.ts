import { getSupabaseBrowserClient } from "./supabase-client";

const BUCKET = "implementation-covers";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Armazenamento indisponível.");
  return client;
}

function validate(file: File) {
  if (!ALLOWED.includes(file.type)) throw new Error("Use uma foto JPG, PNG ou WebP.");
  if (file.size > MAX_BYTES * 3) throw new Error("A foto deve ter no máximo 24 MB.");
}

function extension(file: File) {
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

/** Reduz a capa para no máximo 1600 px e WebP ~82% antes do envio. */
export async function compressCover(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (!blob || (blob.size >= file.size && scale === 1)) return file;
    return new File([blob], "cover.webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

async function prepare(file: File) {
  validate(file);
  const out = await compressCover(file);
  if (out.size > MAX_BYTES) throw new Error("A foto ficou grande demais mesmo após compactar.");
  return out;
}

/** Exclui a implantação (somente admins; bloqueado se ativa/vinculada ao Core). */
export async function deleteImplementation(implementationId: string, confirmCode: string) {
  const client = requireClient();
  const { data: row } = await client
    .from("implementation_projects")
    .select("cover_image")
    .eq("id", implementationId)
    .maybeSingle();
  const { error } = await client.rpc("admin_delete_implementation", {
    _id: implementationId,
    _confirm_code: confirmCode,
  });
  if (error) throw new Error(error.message);
  const prefix = `implementations/${implementationId}/`;
  const { data: files } = await client.storage.from(BUCKET).list(prefix.slice(0, -1));
  const paths = (files ?? []).map((f) => `${prefix}${f.name}`);
  if (row?.cover_image?.startsWith(prefix) && !paths.includes(row.cover_image)) paths.push(row.cover_image);
  if (paths.length) await client.storage.from(BUCKET).remove(paths);
}

/** Upload legado (rascunho do cadastro). Mantido por compatibilidade. */
export async function uploadImplementationCover(file: File, kind: "property" | "condominium") {
  validate(file);
  const client = requireClient();
  const path = `drafts/${kind}/${crypto.randomUUID()}.${extension(file)}`;
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export type CoverSource = "implementation" | "condominium" | null;

export interface AdminCoverState {
  source: CoverSource;
  implementationUrl: string | null;
  approvedAt: string | null;
  condominium: {
    id: string;
    name: string;
    url: string | null;
    externalAllowed: boolean;
  } | null;
}

async function sign(path: string | null | undefined, prefix: string): Promise<string | null> {
  if (!path || !path.startsWith(prefix)) return null;
  const client = requireClient();
  const { data } = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function getAdminCoverState(implementationId: string): Promise<AdminCoverState> {
  const client = requireClient();
  const { data: row, error } = await client
    .from("implementation_projects")
    .select("id, cover_image, cover_source, cover_approved_at, condominium_id")
    .eq("id", implementationId)
    .single();
  if (error) throw error;
  let condominium: AdminCoverState["condominium"] = null;
  if (row.condominium_id) {
    const { data: condo } = await client
      .from("admin_condominiums")
      .select("id, name, cover_image, cover_external_allowed")
      .eq("id", row.condominium_id)
      .maybeSingle();
    if (condo) {
      condominium = {
        id: condo.id,
        name: condo.name,
        url: await sign(condo.cover_image, `condominiums/${condo.id}/`),
        externalAllowed: condo.cover_external_allowed,
      };
    }
  }
  return {
    source: (row.cover_source as CoverSource) ?? null,
    implementationUrl: await sign(row.cover_image, `implementations/${row.id}/`),
    approvedAt: row.cover_approved_at,
    condominium,
  };
}

async function removeOwnedFile(path: string | null | undefined, prefix: string) {
  if (!path || !path.startsWith(prefix)) return;
  await requireClient().storage.from(BUCKET).remove([path]);
}

export async function uploadImplementationCoverFor(implementationId: string, file: File) {
  validate(file);
  const client = requireClient();
  const prefix = `implementations/${implementationId}/`;
  const path = `${prefix}${crypto.randomUUID()}.${extension(file)}`;
  const { error: upErr } = await client.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;
  const { data: current } = await client
    .from("implementation_projects")
    .select("cover_image")
    .eq("id", implementationId)
    .single();
  const { data: auth } = await client.auth.getUser();
  const { error } = await client
    .from("implementation_projects")
    .update({
      cover_image: path,
      cover_source: "implementation",
      cover_approved_at: new Date().toISOString(),
      cover_approved_by: auth.user?.id ?? null,
    })
    .eq("id", implementationId);
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw error;
  }
  await removeOwnedFile(current?.cover_image, prefix);
}

export async function setImplementationCoverSource(implementationId: string, source: CoverSource) {
  const client = requireClient();
  const { data: auth } = await client.auth.getUser();
  const patch: Record<string, unknown> = { cover_source: source };
  if (source === "condominium") {
    patch["cover_approved_at"] = new Date().toISOString();
    patch["cover_approved_by"] = auth.user?.id ?? null;
  }
  const { error } = await client
    .from("implementation_projects")
    .update(patch)
    .eq("id", implementationId);
  if (error) throw error;
}

export async function removeImplementationCover(implementationId: string) {
  const client = requireClient();
  const prefix = `implementations/${implementationId}/`;
  const { data: current } = await client
    .from("implementation_projects")
    .select("cover_image, cover_source")
    .eq("id", implementationId)
    .single();
  const patch: Record<string, unknown> = {
    cover_image: null,
    cover_approved_at: null,
    cover_approved_by: null,
  };
  if (current?.cover_source === "implementation") patch["cover_source"] = null;
  const { error } = await client
    .from("implementation_projects")
    .update(patch)
    .eq("id", implementationId);
  if (error) throw error;
  await removeOwnedFile(current?.cover_image, prefix);
}

export async function getCondominiumCover(condominiumId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from("admin_condominiums")
    .select("cover_image, cover_external_allowed")
    .eq("id", condominiumId)
    .single();
  if (error) throw error;
  return {
    url: await sign(data.cover_image, `condominiums/${condominiumId}/`),
    externalAllowed: data.cover_external_allowed,
  };
}

export async function uploadCondominiumCover(condominiumId: string, file: File) {
  validate(file);
  const client = requireClient();
  const prefix = `condominiums/${condominiumId}/`;
  const path = `${prefix}${crypto.randomUUID()}.${extension(file)}`;
  const { error: upErr } = await client.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;
  const { data: current } = await client
    .from("admin_condominiums")
    .select("cover_image")
    .eq("id", condominiumId)
    .single();
  const { error } = await client
    .from("admin_condominiums")
    .update({ cover_image: path })
    .eq("id", condominiumId);
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw error;
  }
  await removeOwnedFile(current?.cover_image, prefix);
}

export async function removeCondominiumCover(condominiumId: string) {
  const client = requireClient();
  const { data: current } = await client
    .from("admin_condominiums")
    .select("cover_image")
    .eq("id", condominiumId)
    .single();
  const { error } = await client
    .from("admin_condominiums")
    .update({ cover_image: null, cover_external_allowed: false })
    .eq("id", condominiumId);
  if (error) throw error;
  await removeOwnedFile(current?.cover_image, `condominiums/${condominiumId}/`);
}

export async function setCondominiumCoverExternal(condominiumId: string, allowed: boolean) {
  const { error } = await requireClient()
    .from("admin_condominiums")
    .update({ cover_external_allowed: allowed })
    .eq("id", condominiumId);
  if (error) throw error;
}
