/**
 * Fase 6 — conteúdo institucional do portal do proprietário.
 *
 * Cada bloco tem rascunho (draft) e versão publicada. O portal público
 * renderiza apenas o que está publicado; "visualizar como proprietário"
 * renderiza o rascunho. Blocos nunca contêm dado pessoal.
 */

export type PortalBlockKind = "hero" | "destaque" | "passo" | "faq" | "rodape";

export const portalBlockKindLabels: Record<PortalBlockKind, string> = {
  hero: "Abertura",
  destaque: "Destaque",
  passo: "Passo do processo",
  faq: "Pergunta frequente",
  rodape: "Rodapé",
};

export const portalBlockKindOrder: PortalBlockKind[] = [
  "hero",
  "destaque",
  "passo",
  "faq",
  "rodape",
];

export interface PortalContentBlock {
  id: string;
  kind: PortalBlockKind;
  draftTitle: string;
  draftBody: string;
  publishedTitle: string | null;
  publishedBody: string | null;
  publishedAt: string | null;
  displayOrder: number;
  updatedAt: string;
}

export interface PortalContentBlockInput {
  kind: PortalBlockKind;
  draftTitle: string;
  draftBody?: string;
  displayOrder?: number;
}

export interface PortalContentBlockPatch {
  kind?: PortalBlockKind;
  draftTitle?: string;
  draftBody?: string;
  displayOrder?: number;
}

export function hasUnpublishedChanges(block: PortalContentBlock): boolean {
  return block.draftTitle !== (block.publishedTitle ?? "") ||
    block.draftBody !== (block.publishedBody ?? "");
}

/** Bloco como o proprietário vê: rascunho na pré-visualização, publicado no portal. */
export function blockView(block: PortalContentBlock, mode: "draft" | "published") {
  return mode === "draft"
    ? { title: block.draftTitle, body: block.draftBody }
    : { title: block.publishedTitle ?? "", body: block.publishedBody ?? "" };
}
