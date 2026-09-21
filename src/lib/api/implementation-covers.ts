import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase-client";

const BUCKET = "implementation-covers";
const STORAGE_PREFIX = `${BUCKET}/`;

export { isSupabaseConfigured as isImplementationCoverUploadAvailable };

export function isImplementationCoverStoragePath(value: string): boolean {
  return value.startsWith(STORAGE_PREFIX);
}

function objectPath(storedValue: string): string {
  return isImplementationCoverStoragePath(storedValue)
    ? storedValue.slice(STORAGE_PREFIX.length)
    : storedValue;
}

export async function uploadImplementationCover(
  implementationId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Envio de imagens não disponível neste ambiente.");

  const extension = file.name.split(".").pop()?.toLocaleLowerCase() || "jpg";
  const path = `${implementationId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return `${STORAGE_PREFIX}${path}`;
}

export async function getImplementationCoverSignedUrl(storedValue: string): Promise<string> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Imagem de capa não disponível neste ambiente.");
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(objectPath(storedValue), 900);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteImplementationCover(storedValue: string): Promise<void> {
  if (!isImplementationCoverStoragePath(storedValue)) return;
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const { error } = await client.storage.from(BUCKET).remove([objectPath(storedValue)]);
  if (error) throw error;
}