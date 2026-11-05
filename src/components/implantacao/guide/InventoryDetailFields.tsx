import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inventoryConditionLabel, type InventoryCondition } from "@/lib/guided-inventory";

export interface DetailValues {
  name: string;
  quantity: string;
  brand: string;
  condition: InventoryCondition | null;
  notes: string;
}
const conditions: InventoryCondition[] = ["bom", "atencao", "danificado"];

export function InventoryDetailFields({ values, onChange, nameReadOnly = false, extra, actions, hideQuantity = false, brandSlot }: {
  values: DetailValues;
  onChange: (patch: Partial<DetailValues>) => void;
  nameReadOnly?: boolean;
  extra?: ReactNode;
  actions?: ReactNode;
  hideQuantity?: boolean;
  brandSlot?: ReactNode;
}) {
  return <div className="space-y-4" data-testid="inventory-detail-fields">
    <label className="block space-y-1.5 text-sm text-muted-foreground">Nome<Input className="h-11 text-sm" value={values.name} readOnly={nameReadOnly} maxLength={120} onChange={(e) => onChange({ name: e.target.value })} /></label>
    <div className={hideQuantity ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
      {!hideQuantity && <label className="block min-w-0 space-y-1.5 text-sm text-muted-foreground">Quantidade<Input className="h-11 text-sm" inputMode="numeric" value={values.quantity} placeholder="—" onChange={(e) => onChange({ quantity: e.target.value.replace(/\D/g, "") })} /></label>}
      <label className="block min-w-0 space-y-1.5 text-sm text-muted-foreground">Marca{brandSlot ?? <Input className="h-11 text-sm" value={values.brand} maxLength={80} placeholder="Ex.: LG" onChange={(e) => onChange({ brand: e.target.value })} />}</label>
    </div>
    <div className="space-y-1.5"><p className="text-sm text-muted-foreground">Estado</p><div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Estado">
      {[...conditions, ...(values.condition && !conditions.includes(values.condition) ? [values.condition] : [])].map((condition) => <Button key={condition} className="h-11 min-w-0 px-2 text-xs" variant={values.condition === condition ? "default" : "outline"} role="radio" aria-checked={values.condition === condition} onClick={() => onChange({ condition: values.condition === condition ? null : condition })}>{inventoryConditionLabel[condition]}</Button>)}
    </div></div>
    {extra}
    <label className="block space-y-1.5 text-sm text-muted-foreground">Observação interna<textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={values.notes} maxLength={1000} onChange={(e) => onChange({ notes: e.target.value })} /></label>
    {actions && <div className="flex flex-wrap gap-2 border-t border-border pt-4 [&_button]:min-h-11">{actions}</div>}
  </div>;
}