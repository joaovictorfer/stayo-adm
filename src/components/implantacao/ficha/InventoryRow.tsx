import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The same touch-safe layout for catalog, amenity and grouped inventory items. */
export function InventoryRow({ name, image, meta, onOpen, onTap, actions, children, group = false, testId = "inventory-row" }: {
  name: string;
  image?: string | null | undefined;
  meta: ReactNode;
  onOpen: () => void;
  /** Toque no nome: ação rápida (ex.: contar +1). Sem ele, abre os detalhes. */
  onTap?: (() => void) | undefined;
  actions?: ReactNode;
  children?: ReactNode;
  group?: boolean;
  testId?: string;
}) {
  return <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b border-border px-2 py-3 last:border-b-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-x-3" data-testid={testId}>
    <Button variant="ghost" className="size-10 overflow-hidden rounded-lg bg-muted p-0 sm:size-14" aria-label={`Detalhes de ${name}`} onClick={onOpen}>
      {image ? <img src={image} alt="" loading="lazy" className="size-full object-cover" /> : <ImageIcon className="size-5 text-muted-foreground" />}
    </Button>
    <Button variant="ghost" className="h-auto min-w-0 flex-col items-start gap-1 whitespace-normal p-0 text-left hover:bg-transparent active:scale-[0.99]" onClick={!group && onTap ? onTap : onOpen} aria-label={!group && onTap ? `Contar mais um: ${name}` : undefined}>
      <span className="w-full break-words text-sm font-semibold leading-snug text-foreground sm:text-base">{name}</span>
      <span className="w-full text-xs font-normal leading-snug text-muted-foreground">{meta}</span>
    </Button>
    {group ? <span /> : <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Resposta para ${name}`}>{actions}</div>}
    {children}
  </li>;
}
