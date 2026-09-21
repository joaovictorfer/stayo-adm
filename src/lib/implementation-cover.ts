import placeholderUrl from "../assets/implementation-cover-placeholder.jpg";
import type { Attachment } from "./api/attachments";
import {
  getImplementationCoverSignedUrl,
  isImplementationCoverStoragePath,
} from "./api/implementation-covers";
import type { ImplementationProject } from "../types/core";

export type ImplementationCoverSource = "implementation" | "condominium" | "attachment" | "placeholder";

export interface ResolvedImplementationCover {
  url: string;
  source: ImplementationCoverSource;
}

function isImage(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith("image/");
}

function attachmentPriority(attachment: Attachment): number {
  const value = `${attachment.category} ${attachment.filename}`.toLocaleLowerCase("pt-BR");
  if (value.includes("capa")) return 0;
  if (value.includes("condom") || value.includes("imóvel") || value.includes("imovel")) return 1;
  return 2;
}

export function selectFallbackAttachment(
  implementationId: string,
  attachments: Attachment[],
): Attachment | null {
  return (
    attachments
      .filter((attachment) => attachment.implementationId === implementationId && isImage(attachment))
      .sort((a, b) => attachmentPriority(a) - attachmentPriority(b) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export async function resolveImplementationCover(input: {
  implementation: ImplementationProject;
  condominiumImage?: string | null;
  attachments?: Attachment[];
  attachmentUrl?: (storagePath: string) => Promise<string>;
}): Promise<ResolvedImplementationCover> {
  const ownCover = input.implementation.coverImage?.trim();
  if (ownCover) {
    return {
      url: isImplementationCoverStoragePath(ownCover)
        ? await getImplementationCoverSignedUrl(ownCover)
        : ownCover,
      source: "implementation",
    };
  }

  if (input.condominiumImage?.trim()) {
    return { url: input.condominiumImage, source: "condominium" };
  }

  const attachment = selectFallbackAttachment(
    input.implementation.id,
    input.attachments ?? [],
  );
  if (attachment && input.attachmentUrl) {
    return { url: await input.attachmentUrl(attachment.storagePath), source: "attachment" };
  }

  return { url: placeholderUrl, source: "placeholder" };
}

export { placeholderUrl as implementationCoverPlaceholderUrl };