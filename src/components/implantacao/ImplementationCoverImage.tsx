import { useQuery } from "@tanstack/react-query";

import { getAttachmentSignedUrl, isAttachmentsAvailable, listOwnerAttachments } from "../../lib/api/attachments";
import { resolveImplementationCover } from "../../lib/implementation-cover";
import type { ImplementationProject } from "../../types/core";

export function implementationCoverQuery(implementation: ImplementationProject) {
  return {
    queryKey: ["implementation-cover", implementation.id, implementation.coverImage, implementation.ownerId],
    queryFn: async () => {
      const attachments = implementation.ownerId && isAttachmentsAvailable()
        ? await listOwnerAttachments(implementation.ownerId)
        : [];
      return resolveImplementationCover({
        implementation,
        attachments,
        attachmentUrl: getAttachmentSignedUrl,
      });
    },
    staleTime: 5 * 60 * 1000,
  } as const;
}

export function ImplementationCoverImage({
  implementation,
  className,
  eager = false,
}: {
  implementation: ImplementationProject;
  className: string;
  eager?: boolean;
}) {
  const cover = useQuery(implementationCoverQuery(implementation));
  return (
    <img
      src={cover.data?.url}
      alt={`Capa de ${implementation.nickname || implementation.condominiumName || implementation.code}`}
      className={className}
      width={1600}
      height={900}
      loading={eager ? "eager" : "lazy"}
    />
  );
}