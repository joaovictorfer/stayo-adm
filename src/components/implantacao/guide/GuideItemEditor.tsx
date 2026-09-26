import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Drawer } from "../../patterns/Drawer";
import { Button } from "../../ui/button";
import type { GuideItemInput } from "../../../lib/api/guides";
import { classificationLabel, isValidPurchaseUrl, validateImage, type GuideClassification } from "../../../lib/guides";

const input =
  "w-full min-h-11 rounded-[var(--radius-control)] border px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-[var(--stayo-forest)]/25";
const style = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" };

export interface EditorValue extends GuideItemInput {
  enabled: boolean;
}

export function GuideItemEditor({
  open,
  onClose,
  initial,
  categories,
  imageUrl,
  isNew,
  mode,
  onSave,
  onDelete,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  initial: EditorValue;
  categories: string[];
  imageUrl: string | null;
  isNew: boolean;
  mode: "implementation" | "catalog";
  onSave: (v: EditorValue, alsoCatalog: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUpload: (file: File) => Promise<string>;
}) {
  const [v, setV] = useState(initial);
  const [alsoCatalog, setAlsoCatalog] = useState(false);
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EditorValue>(k: K, val: EditorValue[K]) => setV((c) => ({ ...c, [k]: val }));

  const valid = v.category.trim() && v.name.trim() && v.recommended_quantity >= 0 && isValidPurchaseUrl(v.purchase_url ?? "");

  const upload = async (file: File) => {
    const err = validateImage(file);
    if (err) return setError(err);
    setBusy(true);
    setError(null);
    try {
      const path = await onUpload(file);
      set("image_path", path);
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!valid) return setError("Confira categoria, nome, quantidade e o link (http/https).");
    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          ...v,
          category: v.category.trim(),
          name: v.name.trim(),
          purchase_url: v.purchase_url?.trim() || null,
          description: v.description?.trim() || null,
          tip: v.tip?.trim() || null,
          quantity_text: v.quantity_text?.trim() || null,
        },
        alsoCatalog,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, node: React.ReactNode, req = false) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label} {req && <span style={{ color: "var(--stayo-danger)" }}>*</span>}
      </span>
      {node}
    </label>
  );

  return (
    <Drawer open={open} onClose={onClose} eyebrow="Guia de utensílios" title={isNew ? "Novo item" : "Editar item"}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] border" style={style}>
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="size-6" style={{ color: "var(--stayo-ink-muted)" }} />}
          </div>
          <div className="flex flex-col gap-1">
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border px-3 text-sm font-medium" style={style}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {v.image_path ? "Trocar foto" : "Enviar foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            </label>
            {v.image_path && (
              <button type="button" className="text-left text-xs underline" onClick={() => { set("image_path", null); setPreview(null); }}>
                Remover foto
              </button>
            )}
            <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>JPG, PNG ou WebP até 5 MB</span>
          </div>
        </div>
        {field(
          "Categoria",
          <>
            <input list="guide-categories" value={v.category} onChange={(e) => set("category", e.target.value)} className={input} style={style} maxLength={60} />
            <datalist id="guide-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </>,
          true,
        )}
        {field("Nome", <input value={v.name} onChange={(e) => set("name", e.target.value)} className={input} style={style} maxLength={120} />, true)}
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
          {field("Quantidade", <input type="number" min={0} value={v.recommended_quantity} onChange={(e) => set("recommended_quantity", Math.max(0, Number(e.target.value) || 0))} className={input} style={style} />, true)}
          {field("Descrição da quantidade", <input value={v.quantity_text ?? ""} placeholder="Ex.: Jogo com 6 peças" onChange={(e) => set("quantity_text", e.target.value)} className={input} style={style} />)}
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">Classificação</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(classificationLabel) as GuideClassification[]).map((c) => (
              <button key={c} type="button" aria-pressed={v.classification === c} onClick={() => set("classification", c)} className="min-h-11 rounded-full border px-4 text-sm" style={{ ...style, ...(v.classification === c ? { backgroundColor: "var(--stayo-forest)", color: "var(--primary-foreground)", borderColor: "var(--stayo-forest)" } : {}) }}>
                {classificationLabel[c]}
              </button>
            ))}
          </div>
        </div>
        {field("Descrição / especificação", <textarea rows={3} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} className={input} style={style} />)}
        {field("Dica STAYO", <textarea rows={2} value={v.tip ?? ""} onChange={(e) => set("tip", e.target.value)} className={input} style={style} />)}
        {field(
          "Indicação de compra (link)",
          <input type="url" value={v.purchase_url ?? ""} placeholder="https://" onChange={(e) => set("purchase_url", e.target.value)} className={input} style={{ ...style, borderColor: isValidPurchaseUrl(v.purchase_url ?? "") ? style.borderColor : "var(--stayo-danger)" }} />,
        )}
        <div className="grid grid-cols-2 gap-3">
          {field("Ordem", <input type="number" value={v.display_order} onChange={(e) => set("display_order", Number(e.target.value) || 0)} className={input} style={style} />)}
          <label className="flex min-h-11 items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-5" />
            {mode === "catalog" ? "Ativo no catálogo" : "Ativo nesta implantação"}
          </label>
        </div>
        {isNew && mode === "implementation" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={alsoCatalog} onChange={(e) => setAlsoCatalog(e.target.checked)} className="size-5" />
            Adicionar também ao catálogo STAYO
          </label>
        )}
        {error && <p role="alert" className="text-sm" style={{ color: "var(--stayo-danger)" }}>{error}</p>}
        <div className="flex gap-2">
          {onDelete && !isNew && (
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void onDelete().then(onClose)} aria-label="Excluir item">
              <Trash2 />
            </Button>
          )}
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Cancelar</Button>
          <Button type="button" className="min-h-11 flex-1" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

export const emptyItem = (category = "Cozinha"): EditorValue => ({
  category,
  name: "",
  recommended_quantity: 1,
  quantity_text: null,
  description: null,
  tip: null,
  purchase_url: null,
  image_path: null,
  classification: "recomendado",
  display_order: 0,
  enabled: true,
});
