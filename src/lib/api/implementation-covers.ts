import { getSupabaseBrowserClient } from "./supabase-client";

const BUCKET = "implementation-covers";

export async function uploadImplementationCover(file: File, kind: "property" | "condominium") {
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem válida.");
  if (file.size > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB.");
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const path = `drafts/${kind}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}