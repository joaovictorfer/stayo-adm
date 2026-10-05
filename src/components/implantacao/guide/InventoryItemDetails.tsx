import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Trash2 } from "lucide-react";

import { Button } from "../../ui/button";
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
      className="mt-2 rounded-lg bg-[var(--stayo-bg)] p-3"
      data-testid="inventory-inline-details"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs" style={muted}>
          {inventoryOriginLabel(item)} · detalhes opcionais
        </p>
        <span
          className="flex items-center gap-1 text-[11px]"
          style={save === "error" ? { color: "var(--stayo-danger)" } : muted}
          aria-live="polite"
        >
          {save === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" /> Salvando…
            </>
          )}
          {save === "error" && "Erro ao salvar"}
        </span>
      </div>
      <div className="space-y-3">
        <label className="block text-xs" style={muted}>
          Nome
          <input
            autoFocus={item.name.endsWith(" (cópia)")}
            className={field}
            style={border}
            value={d.name}
            maxLength={120}
            required
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs" style={muted}>
            Quantidade
            <input
              className={field}
              style={border}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
              placeholder="—"
            />
          </label>
          <label className="block text-xs" style={muted}>
            Marca
            <input
              className={field}
              style={border}
              value={d.inventory_brand ?? ""}
              maxLength={80}
              onChange={(e) => setD({ ...d, inventory_brand: e.target.value })}
              placeholder="Ex.: LG"
            />
          </label>
        </div>
        <div className="text-xs" style={muted}>
          Estado
          <div
            className="mt-1 flex gap-1"
            role="radiogroup"
            aria-label="Estado"
          >
            {CONDITIONS.map((c) => {
              const on = d.inventory_condition === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() =>
                    setD({ ...d, inventory_condition: on ? null : c })
                  }
                  className="min-h-9 flex-1 rounded-md border text-xs"
                  style={
                    on
                      ? {
                          backgroundColor: "var(--stayo-primary, #0b3150)",
                          color: "var(--stayo-on-primary, #fff)",
                          borderColor: "transparent",
                        }
                      : border
                  }
                >
                  {inventoryConditionLabel[c]}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block text-xs" style={muted}>
          Observação interna (não aparece para o proprietário)
          <textarea
            className="min-h-20 w-full rounded-md border p-2 text-sm"
            style={border}
            maxLength={1000}
            value={d.inventory_internal_notes ?? ""}
            onChange={(e) =>
              setD({ ...d, inventory_internal_notes: e.target.value })
            }
            placeholder="Ex.: Instalador: On Instaladora"
          />
        </label>
        {item.inventory_updated_at && (
          <p className="text-[11px]" style={muted}>
            Última alteração:{" "}
            {new Date(item.inventory_updated_at).toLocaleString("pt-BR")}
          </p>
        )}
        {err && (
          <p
            className="text-xs"
            role="alert"
            style={{ color: "var(--stayo-danger, #b42318)" }}
          >
            {err}
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-3">
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={onClose}
          >
            Fechar detalhes
          </Button>
        </div>
      </div>
    </div>
  ) : null;
}
