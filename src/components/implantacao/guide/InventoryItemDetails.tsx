import { useEffect, useRef, useState } from "react";
import { InventoryDetailFields } from "./InventoryDetailFields";
import { Copy, Trash2 } from "lucide-react";

import { Button } from "../../ui/button";
import { type InventorySnapshotItem } from "../../../lib/guided-inventory";
import type { InventoryDetails } from "../../../lib/api/guided-inventory";

interface Props {
  item: InventorySnapshotItem | null;
  onClose: () => void;
  onSave: (d: InventoryDetails) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onRemove: () => Promise<void>;
}

export function InventoryItemDetails({
  item,
  onClose,
  onSave,
  onDuplicate,
  onRemove,
}: Props) {
  const [d, setD] = useState<InventoryDetails | null>(null);
  const [qty, setQty] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const timer = useRef<number | null>(null);
  const initial = useRef(true);

  useEffect(() => {
    if (!item) return;
    setD({
      name: item.name,
      inventory_quantity: item.inventory_quantity ?? null,
      inventory_brand: item.inventory_brand ?? "",
      inventory_condition: item.inventory_condition ?? null,
      inventory_internal_notes: item.inventory_internal_notes ?? "",
    });
    setQty(
      item.inventory_quantity != null ? String(item.inventory_quantity) : "",
    );
    setErr(null);
    setSave("idle");
    initial.current = true;
  }, [item]);

  const persist = async (next: InventoryDetails, nextQty: string) => {
    const n = nextQty.trim() === "" ? null : Number(nextQty);
    if (n != null && (!Number.isInteger(n) || n < 0)) {
      setSave("error");
      setErr("Quantidade inválida");
      return;
    }
    setSave("saving");
    setErr(null);
    try {
      await onSave({ ...next, inventory_quantity: n });
      setSave("saved");
    } catch (e) {
      setErr((e as Error).message || "Não salvou. Tente de novo.");
      setSave("error");
    }
  };

  useEffect(() => {
    if (!item || !d) return;
    if (initial.current) {
      initial.current = false;
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    setSave("saving");
    timer.current = window.setTimeout(() => void persist(d, qty), 700);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // onSave is intentionally invoked only after editable values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, qty]);

  const canRemove = item && !item.catalog_item_id;

  return item && d ? (
    <div
      className="space-y-3"
      data-testid="inventory-inline-details"
    >
      <span className="sr-only" aria-live="polite">{save === "saving" ? "Salvando" : save === "error" ? "Erro ao salvar" : ""}</span>
      <InventoryDetailFields values={{ name: d.name ?? item.name, quantity: qty, brand: d.inventory_brand ?? "", condition: d.inventory_condition ?? null, notes: d.inventory_internal_notes ?? "" }} onChange={(patch) => {
        if (patch.quantity !== undefined) setQty(patch.quantity);
        setD({ ...d, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.brand !== undefined ? { inventory_brand: patch.brand } : {}), ...(patch.condition !== undefined ? { inventory_condition: patch.condition } : {}), ...(patch.notes !== undefined ? { inventory_internal_notes: patch.notes } : {}) });
      }} actions={<>
        {err && (
          <p
            className="text-xs"
            role="alert"
            className="text-xs text-destructive"
          >
            {err}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSave("saving");
              setErr(null);
              void onDuplicate().catch((e) => {
                setErr((e as Error).message || "Não foi possível duplicar.");
                setSave("error");
              });
            }}
          >
            <Copy className="size-3.5" /> Duplicar item
          </Button>
          {canRemove && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Remover "${item.name}"?`))
                  void onRemove()
                    .then(onClose)
                    .catch((e) => {
                      setErr((e as Error).message);
                      setSave("error");
                    });
              }}
            >
              <Trash2 className="size-3.5" /> Excluir
            </Button>
          )}
        </div>
      </>} />
    </div>
  ) : null;
}
