import { Camera, Check, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { compressImageToBase64 } from "@/lib/image-compress";

export interface ChecklistRow { id: string; area: string | null; label: string; requires_photo: boolean; checked_at: string | null; photo_path: string | null; photoUrl: string | null }

/** Lista de checklist compartilhada por Admin e Meu Dia: marcar item e anexar foto. */
export function OpChecklistList({ items, disabled, onToggle, onPhoto }: { items: ChecklistRow[]; disabled?: boolean; onToggle: (id: string, checked: boolean) => Promise<unknown>; onPhoto: (id: string, base64: string) => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const run = async (id: string, fn: () => Promise<unknown>) => { setBusy(id); try { await fn(); } finally { setBusy(null); } };
  let lastArea: string | null = "__";
  if (!items.length) return <p className="text-sm text-muted-foreground">Sem checklist nesta tarefa.</p>;
  return <div className="divide-y divide-border rounded-lg border border-border">
    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
      const f = e.target.files?.[0]; const id = target.current; e.target.value = "";
      if (f && id) void run(id, async () => onPhoto(id, await compressImageToBase64(f)));
    }} />
    {items.map((i) => {
      const header = i.area && i.area !== lastArea ? <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{i.area}</div> : null;
      lastArea = i.area;
      const checked = !!i.checked_at;
      return <div key={i.id}>{header}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button type="button" aria-label={checked ? `Desmarcar ${i.label}` : `Marcar ${i.label}`} aria-pressed={checked} disabled={disabled || busy === i.id}
            onClick={() => run(i.id, () => onToggle(i.id, !checked))}
            className={`flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors ${checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>
            {busy === i.id ? <Loader2 className="size-4 animate-spin" /> : checked && <Check className="size-4" />}
          </button>
          <span className={`min-w-0 flex-1 text-sm ${checked ? "text-muted-foreground line-through" : ""}`}>{i.label}
            {i.requires_photo && !i.photo_path && <small className="ml-1 text-xs font-medium text-destructive no-underline">· foto obrigatória</small>}</span>
          {i.photoUrl && <a href={i.photoUrl} target="_blank" rel="noreferrer"><img src={i.photoUrl} alt={`Foto: ${i.label}`} className="size-10 rounded-md object-cover" /></a>}
          <button type="button" aria-label={`Foto de ${i.label}`} disabled={disabled || busy === i.id} onClick={() => { target.current = i.id; fileRef.current?.click(); }}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted disabled:opacity-50"><Camera className="size-4" /></button>
        </div></div>;
    })}
  </div>;
}
