import { useQuery } from "@tanstack/react-query";

import { getAttachmentSignedUrl, isAttachmentsAvailable, listOwnerAttachments } from "../../lib/api/attachments";
import { coreApi } from "../../lib/api/queries";
import { resolveImplementationCover } from "../../lib/implementation-cover";
import { implementationCoverPlaceholderUrl } from "../../lib/implementation-cover";
import type { ImplementationProject } from "../../types/core";

export function implementationCoverQuery(implementation: ImplementationProject) {
  return {
    queryKey: ["implementation-cover", implementation.id, implementation.coverImage, implementation.ownerId],
    queryFn: async () => {
      const [attachments, condominiums] = await Promise.all([
        implementation.ownerId && isAttachmentsAvailable()
          ? listOwnerAttachments(implementation.ownerId)
          : Promise.resolve([]),
        implementation.condominiumName
          ? coreApi.condominiums.list()
          : Promise.resolve({ data: [], nextCursor: null }),
      ]);
      const condominiumImage = condominiums.data.find(
        (item) => item.name.toLocaleLowerCase("pt-BR") === implementation.condominiumName?.toLocaleLowerCase("pt-BR"),
      )?.coverImage ?? null;
      return resolveImplementationCover({
        implementation,
        condominiumImage,
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
      src={cover.data?.url ?? implementationCoverPlaceholderUrl}
      alt={`Capa de ${implementation.nickname || implementation.condominiumName || implementation.code}`}
      className={className}
      width={1600}
      height={900}
      loading={eager ? "eager" : "lazy"}
    />
  );
}