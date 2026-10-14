import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function InventoryDetailLayout({ open, onOpenChange, name, media, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  media?: { url?: string | null | undefined; quantity_text?: string | null | undefined; description?: string | null | undefined; tip?: string | null | undefined } | undefined;
  children: ReactNode;
}) {
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-lg sm:p-5 data-[state=open]:duration-150 data-[state=closed]:duration-100 motion-reduce:animate-none motion-reduce:transition-none" aria-describedby={undefined}>
      <SheetHeader className="pr-8 text-left"><SheetTitle className="break-words text-lg">{name}</SheetTitle></SheetHeader>
      <div className="mt-4 space-y-4" data-testid="inventory-detail-layout">
        <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
          {media?.url ? <img src={media.url} alt={name} className="h-full w-full object-contain p-2" /> : <ImageIcon className="size-8 text-muted-foreground" />}
        </div>
        {(media?.quantity_text || media?.description || media?.tip) && <div className="space-y-1 rounded-lg border border-border px-3 py-2.5 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">Recomendação{media.quantity_text ? ` · ${media.quantity_text}` : ""}</p>
          {media.description && <p className="text-foreground">{media.description}</p>}
          {media.tip && <p className="text-xs text-muted-foreground">{media.tip}</p>}
        </div>}
        {children}
      </div>
    </SheetContent>
  </Sheet>;
}