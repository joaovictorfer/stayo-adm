import { useEffect, useState } from "react";

import { Button } from "../../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import {
  inventoryConditionLabel,
  inventoryOriginLabel,
  type InventoryCondition,
  type InventorySnapshotItem,
} from "../../../lib/guided-inventory";
import type { InventoryDetails } from "../../../lib/api/guided-inventory";

const muted = { color: "var(--stayo-ink-muted)" };
const field = "h-10 w-full rounded-md border px-3 text-sm";
const border = { borderColor: "var(--stayo-border)" };
const CONDITIONS: InventoryCondition[] = ["bom", "atencao", "danificado"];

interface Props {
  item: InventorySnapshotItem | null;
  onClose: () => void;
  onSave: (d: InventoryDetails) => Promise<void>;
  onDuplicate: (name: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function InventoryItemDetails({ item, onClose, onSave, onDuplicate, onRemove }: Props) {
  const [d, setD] = useState<InventoryDetails | null>(null);
  const [qty, setQty] = useState("");
  const [dup, setDup] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setD({
      name: item.name,
      inventory_quantity: item.inventory_quantity ?? null,
      inventory_brand: item.inventory_brand ?? "",
      inventory_condition: item.inventory_condition ?? null,
      inventory_internal_notes: item.inventory_internal_notes ?? "",
    });
    setQty(item.inventory_quantity != null ? String(item.inventory_quantity) : "");
    setDup(null);
    setErr(null);
  }, [item]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message || "Não salvou. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const canRemove = item && !item.catalog_item_id;

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {item && d && (
          <>
            <SheetHeader>
              <SheetTitle>Detalhes do item</SheetTitle>
              <SheetDescription>
                {inventoryOriginLabel(item)} · tudo opcional; "Tenho" já basta.
              </SheetDescription>
            </SheetHeader>

            {dup === null ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = qty.trim() === "" ? null : Number(qty);
                  if (n != null && (!Number.isInteger(n) || n < 0)) return setErr("Quantidade inválida");
                  void run(async () => {
                    await onSave({ ...d, inventory_quantity: n });
                    onClose();
                  });
                }}
              >
                <label className="block text-xs" style={muted}>Nome
                  <input className={field} style={border} value={d.name} maxLength={120} required onChange={(e) => setD({ ...d, name: e.target.value })} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs" style={muted}>Quantidade
                    <input className={field} style={border} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="—" />
                  </label>
                  <label className="block text-xs" style={muted}>Marca
                    <input className={field} style={border} value={d.inventory_brand ?? ""} maxLength={80} onChange={(e) => setD({ ...d, inventory_brand: e.target.value })} placeholder="Ex.: LG" />
                  </label>
                </div>
                <div className="text-xs" style={muted}>Estado
                  <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Estado">
                    {CONDITIONS.map((c) => {
                      const on = d.inventory_condition === c;
                      return (
                        <button key={c} type="button" role="radio" aria-checked={on}
                          onClick={() => setD({ ...d, inventory_condition: on ? null : c })}
                          className="min-h-9 flex-1 rounded-md border text-xs"
                          style={on ? { backgroundColor: "var(--stayo-primary, #0b3150)", color: "var(--stayo-on-primary, #fff)", borderColor: "transparent" } : border}>
                          {inventoryConditionLabel[c]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block text-xs" style={muted}>Observação interna (não aparece para o proprietário)
                  <textarea className="min-h-20 w-full rounded-md border p-2 text-sm" style={border} maxLength={1000}
                    value={d.inventory_internal_notes ?? ""} onChange={(e) => setD({ ...d, inventory_internal_notes: e.target.value })}
                    placeholder="Ex.: Instalador: On Instaladora" />
                </label>
                <p className="text-[11px]" style={muted}>Foto: ainda não disponível.</p>
                {item.inventory_updated_at && (
                  <p className="text-[11px]" style={muted}>Última alteração: {new Date(item.inventory_updated_at).toLocaleString("pt-BR")}</p>
                )}
                {err && <p className="text-xs" role="alert" style={{ color: "var(--stayo-danger, #b42318)" }}>{err}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={busy}>Salvar</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setDup(""); setErr(null); }}>Duplicar item</Button>
                  {canRemove && (
                    <Button type="button" size="sm" variant="ghost" disabled={busy}
                      onClick={() => { if (confirm(`Remover "${item.name}"?`)) void run(async () => { await onRemove(); onClose(); }); }}>
                      Remover
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={(e) => {
                e.preventDefault();
                void run(async () => { await onDuplicate(dup); onClose(); });
              }}>
                <p className="text-sm">Nova cópia de <b>{item.name}</b> no mesmo ambiente. Resposta, marca, estado e observação não são copiados.</p>
                <label className="block text-xs" style={muted}>Nome da cópia (obrigatório)
                  <input autoFocus className={field} style={border} value={dup} maxLength={120} onChange={(e) => setDup(e.target.value)} placeholder="Ex.: Forma de pizza grande" />
                </label>
                {err && <p className="text-xs" role="alert" style={{ color: "var(--stayo-danger, #b42318)" }}>{err}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={busy || !dup.trim()}>Criar cópia</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDup(null)}>Cancelar</Button>
                </div>
              </form>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
