/**
 * Templates de checklist de implantação.
 *
 * As categorias/fases mudam com o tempo (ex: os campos exigidos pelo
 * Airbnb hoje não são os de amanhã), então isso NUNCA pode ser
 * hardcoded — é conteúdo editável pela equipe.
 *
 * O Stayo Core v1 ainda não expõe este domínio; enquanto isso, o
 * repositório local (`src/lib/api/local-store.ts`) guarda os dados no
 * navegador atrás da mesma forma de API que o Core terá.
 */

import type { EntityId } from "./core";

export interface ChecklistTemplateItem {
  id: EntityId;
  category: string;
  phase: string;
  title: string;
  description: string | null;
  mandatory: boolean;
  blocker: boolean;
  ownerVisible: boolean;
  order: number;
}

export type ChecklistTemplateItemInput = Omit<ChecklistTemplateItem, "id">;
