import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { StayoLogo, stayoLogoUrl } from "@/components/brand/StayoLogo";
import { inventoryRooms, inventoryConditionLabel, surveyConditions } from "@/lib/guided-inventory";
import { generatedInventoryImage } from "@/lib/inventory-generated-media";
import {
  addSurveyNotePreset,
  resolveSurvey,
  saveSurveyItem,
  type SurveyData,
  type SurveyItem,
} from "@/lib/api/implementation-survey";
import { deleteSurveyPhoto, getSurveyMedia, uploadSurveyPhoto } from "@/lib/survey.functions";
import { surveyStickerText, watermarkPhoto } from "@/lib/survey-watermark";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Photo = { id: string; itemId: string; url: string };
const BRAND_SPECIAL = ["N/A", "Não identificada"];
const roomLabel = (k: string) => inventoryRooms.find((r) => r.key === k)?.label ?? k;

export function SurveyExperience({
  token,
  embedded = false,
}: {
  token: string;
  embedded?: boolean;
}) {
  const [data, setData] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SurveyItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sidebar, setSidebar] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingItems = useRef<Record<string, SurveyItem>>({});
  const chain = useRef(Promise.resolve());
  const persist = (entry: SurveyItem) => {
    chain.current = chain.current.then(async () => {
      try {
        await saveSurveyItem(token, entry);
        if (pendingItems.current[entry.id] === entry) delete pendingItems.current[entry.id];
        setSaving(Object.keys(pendingItems.current).length ? "saving" : "saved");
      } catch {
        setSaving("error");
      }
    });
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingItems.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    resolveSurvey(token)
      .then((d) => {
        setData(d);
        const order = inventoryRooms.map((r) => r.key as string);
        setItems([...d.items].sort((a, b) => order.indexOf(a.room) - order.indexOf(b.room)));
      })
      .catch((e: Error) => setError(e.message));
    getSurveyMedia({ data: { token } })
      .then((m) => {
        setPhotos(m.photos);
        setRefs(m.references);
      })
      .catch(() => undefined);
  }, [token]);

  const item = items[index];
  const answered = items.filter((i) => i.answer).length;
  const rooms = useMemo(() => {
    const map = new Map<string, { item: SurveyItem; idx: number }[]>();
    items.forEach((it, idx) => {
      const key = ["quartos", "banheiros"].includes(it.room) ? it.category : it.room;
      map.set(key, [...(map.get(key) ?? []), { item: it, idx }]);
    });
    return [...map.entries()];
  }, [items]);

  const update = useCallback(
    (patch: Partial<SurveyItem>) => {
      setItems((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (!cur) return prev;
        const merged = { ...cur, ...patch };
        next[index] = merged;
        clearTimeout(timers.current[merged.id]);
        setSaving("saving");
        pendingItems.current[merged.id] = merged;
        timers.current[merged.id] = setTimeout(() => persist(merged), 600);
        return next;
      });
    },
    [index, token],
  );

  if (error)
    return (
      <Centered>
        <p className="text-lg font-semibold">Link inválido ou expirado</p>
        <p className="text-muted-foreground">Peça um novo link para a equipe STAYO.</p>
      </Centered>
    );
  if (!data)
    return (
      <Centered>
        <Loader2 className="size-8 animate-spin text-primary" />
      </Centered>
    );
  if (!item)
    return (
      <Centered>
        <p className="text-lg font-semibold">Nenhum item no inventário</p>
        <p className="text-muted-foreground">Monte o inventário na ficha antes de vistoriar.</p>
      </Centered>
    );

  const itemPhotos = photos.filter((p) => p.itemId === item.id);
  const reference = refs[item.name] ?? generatedInventoryImage(item.name);
  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(items.length - 1, i)));
    setSidebar(false);
  };

  return (
    <div
      className={cn(
        "field-registration flex flex-col bg-muted/40 text-foreground",
        embedded ? "min-h-0 flex-1" : "h-dvh",
      )}
    >
      {/* Topo */}
      <header className="flex items-center gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
        <Button
          variant="ghost"
          type="button"
          onClick={() => setSidebar(true)}
          className="grid size-10 place-items-center rounded-full bg-primary-foreground/10 lg:hidden"
          aria-label="Lista de itens"
        >
          <ListChecks className="size-5" />
        </Button>
        <StayoLogo variant="white" className="h-7 w-auto" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{data.implementation.name}</p>
          <p className="text-xs opacity-75">
            Vistoria de implantação · {answered}/{items.length} itens
          </p>
        </div>
        <SaveBadge state={saving} />
        {saving === "error" && (
          <Button
            variant="ghost"
            className="text-primary-foreground"
            onClick={() => Object.values(pendingItems.current).forEach(persist)}
          >
            Tentar novamente
          </Button>
        )}
      </header>
      <div className="h-1 bg-primary/20">
        <div
          className="h-full bg-[var(--stayo-success)] transition-all"
          style={{ width: `${(answered / items.length) * 100}%` }}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Barra lateral */}
        {sidebar && (
          <div
            className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
            onClick={() => setSidebar(false)}
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] overflow-y-auto border-r bg-background lg:static lg:z-0 lg:w-72",
            sidebar ? "block" : "hidden lg:block",
          )}
        >
          {rooms.map(([room, list]) => {
            const done = list.filter((l) => l.item.answer).length;
            return (
              <div key={room} className="border-b">
                <div className="sticky top-0 flex items-center justify-between bg-background/95 px-4 py-2.5 backdrop-blur">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {roomLabel(room)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {done}/{list.length}
                  </span>
                </div>
                {list.map(({ item: it, idx }) => (
                  <Button
                    variant="ghost"
                    key={it.id}
                    type="button"
                    onClick={() => go(idx)}
                    className={cn(
                      "flex w-full justify-start items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted",
                      idx === index && "bg-primary/10 font-semibold text-primary",
                    )}
                  >
                    <StatusDot answer={it.answer} />
                    <span className="truncate">{it.name}</span>
                    {photos.some((p) => p.itemId === it.id) && (
                      <Camera className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </Button>
                ))}
              </div>
            );
          })}
        </aside>

        {/* Item em tela cheia */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:p-6">
              <section className="order-2 space-y-3 md:order-1">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-background shadow-sm md:aspect-square">
                  {itemPhotos.length ? (
                    <img
                      src={itemPhotos.at(-1)?.url}
                      alt={item.name}
                      className="size-full object-cover"
                    />
                  ) : reference ? (
                    <img
                      src={reference}
                      alt={`Referência: ${item.name}`}
                      className="size-full object-contain p-6"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <Camera className="size-10" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold shadow">
                    {itemPhotos.length ? "Foto da vistoria" : "Referência"}
                  </span>
                </div>
                <PhotoStrip
                  token={token}
                  item={item}
                  photos={itemPhotos}
                  propertyName={data.implementation.name}
                  onAdd={(p) => setPhotos((prev) => [...prev, p])}
                  onRemove={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
                />
              </section>

              <section className="order-1 space-y-6 md:order-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {roomLabel(item.room)} · {item.category}
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold">{item.name}</h1>
                  {item.tip && <p className="mt-2 text-sm text-muted-foreground">{item.tip}</p>}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <AnswerButton
                    active={item.answer === "tenho"}
                    tone="yes"
                    onClick={() =>
                      update({
                        answer: item.answer === "tenho" ? null : "tenho",
                        quantity: item.quantity ?? 1,
                      })
                    }
                  >
                    <Check className="size-7" /> Tem
                  </AnswerButton>
                  <AnswerButton
                    active={item.answer === "nao_tenho"}
                    tone="no"
                    onClick={() =>
                      update({ answer: item.answer === "nao_tenho" ? null : "nao_tenho" })
                    }
                  >
                    <X className="size-7" /> Não tem
                  </AnswerButton>
                  <AnswerButton
                    active={item.answer === "nao_aplica"}
                    tone="na"
                    onClick={() =>
                      update({ answer: item.answer === "nao_aplica" ? null : "nao_aplica" })
                    }
                  >
                    <span className="text-xl font-bold">N/A</span> Não se aplica
                  </AnswerButton>
                </div>

                {item.answer === "tenho" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <Field label="Quantidade">
                      <div className="flex items-center gap-3">
                        <RoundBtn
                          onClick={() =>
                            update({ quantity: Math.max(0, (item.quantity ?? 0) - 1) })
                          }
                          label="Diminuir"
                        >
                          <Minus className="size-5" />
                        </RoundBtn>
                        <input
                          inputMode="numeric"
                          value={item.quantity ?? ""}
                          onChange={(e) =>
                            update({
                              quantity:
                                e.target.value === ""
                                  ? null
                                  : Math.min(999, Number(e.target.value.replace(/\D/g, "")) || 0),
                            })
                          }
                          className="h-12 w-20 rounded-xl border bg-background text-center text-xl font-semibold"
                          aria-label="Quantidade"
                        />
                        <RoundBtn
                          onClick={() =>
                            update({ quantity: Math.min(999, (item.quantity ?? 0) + 1) })
                          }
                          label="Aumentar"
                        >
                          <Plus className="size-5" />
                        </RoundBtn>
                      </div>
                    </Field>
                    <Field label="Estado de uso">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {surveyConditions.map((c) => (
                          <Chip
                            key={c}
                            big
                            active={item.condition === c}
                            onClick={() => update({ condition: item.condition === c ? null : c })}
                          >
                            {inventoryConditionLabel[c]}
                          </Chip>
                        ))}
                      </div>
                    </Field>
                    <BrandField
                      value={item.brand}
                      brands={data.brands}
                      onChange={(brand) => update({ brand })}
                    />
                  </div>
                )}

                <NotesField
                  token={token}
                  value={item.notes}
                  presets={data.notes}
                  onChange={(notes) => update({ notes })}
                  onPreset={(t) =>
                    setData((d) =>
                      d && !d.notes.includes(t) ? { ...d, notes: [...d.notes, t] } : d,
                    )
                  }
                />
              </section>
            </div>
          </div>

          <footer className="flex items-center gap-3 border-t bg-background p-3 md:px-6">
            <Button
              variant="ghost"
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="flex h-12 items-center gap-2 rounded-lg border px-3 sm:px-5 font-semibold disabled:opacity-40"
            >
              <ChevronLeft className="size-5" /> Anterior
            </Button>
            <p className="flex-1 text-center text-sm text-muted-foreground">
              {index + 1} de {items.length}
            </p>
            <Button
              variant="ghost"
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === items.length - 1}
              className="flex h-12 items-center gap-2 rounded-lg bg-primary px-3 sm:px-6 font-semibold text-primary-foreground shadow disabled:opacity-40"
            >
              Próximo <ChevronRight className="size-5" />
            </Button>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-dvh place-items-center bg-muted/40 p-6 text-center">
      <div className="space-y-2">
        <StayoLogo className="mx-auto mb-4 h-10 w-auto" />
        {children}
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const text = { saving: "Salvando…", saved: "Salvo", error: "Erro ao salvar" }[state];
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        state === "error"
          ? "bg-destructive text-destructive-foreground"
          : "bg-primary-foreground/15",
      )}
    >
      {text}
    </span>
  );
}

function StatusDot({ answer }: { answer: SurveyItem["answer"] }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-2",
        answer === "tenho" &&
          "border-[var(--stayo-success)] bg-[var(--stayo-success)] text-background",
        answer === "nao_tenho" && "border-destructive bg-destructive text-background",
        answer === "nao_aplica" && "border-muted-foreground bg-muted-foreground text-background",
        !answer && "border-border",
      )}
    >
      {answer === "tenho" && <Check className="size-3" />}
      {answer === "nao_tenho" && <X className="size-3" />}
    </span>
  );
}

function AnswerButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "yes" | "no" | "na";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls = {
    yes: "border-[var(--stayo-success)] bg-[var(--stayo-success)] text-background",
    no: "border-destructive bg-destructive text-destructive-foreground",
    na: "border-muted-foreground bg-muted-foreground text-background",
  }[tone];
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-24 flex-col items-center justify-center gap-1 rounded-lg border-2 bg-background text-sm font-semibold shadow-sm transition-all active:scale-95 motion-reduce:transition-none",
        active ? `${activeCls} hover:opacity-90` : "hover:border-primary/40",
      )}
    >
      {children}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function RoundBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-12 place-items-center rounded-full border bg-background active:scale-95"
    >
      {children}
    </Button>
  );
}

function Chip({
  active,
  onClick,
  children,
  big,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  big?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-4 text-sm font-medium transition-colors",
        big ? "h-12" : "h-10",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:border-primary/40",
      )}
    >
      {children}
    </Button>
  );
}

function BrandField({
  value,
  brands,
  onChange,
}: {
  value: string | null;
  brands: string[];
  onChange: (v: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = brands
    .filter((b) => !q || b.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 12);
  const exists = brands.some((b) => b.toLowerCase() === q.trim().toLowerCase());
  return (
    <Field label="Marca">
      {value && (
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            {value}
          </span>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onChange(null)}
            className="text-sm text-muted-foreground underline"
          >
            Trocar
          </Button>
        </div>
      )}
      {!value && (
        <div className="space-y-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ou digitar nova marca"
            className="h-12 w-full rounded-xl border bg-background px-4"
          />
          <div className="flex flex-wrap gap-2">
            {BRAND_SPECIAL.map((b) => (
              <Chip key={b} active={false} onClick={() => onChange(b)}>
                {b}
              </Chip>
            ))}
            {filtered.map((b) => (
              <Chip key={b} active={false} onClick={() => onChange(b)}>
                {b}
              </Chip>
            ))}
            {q.trim() && !exists && (
              <Chip
                active
                onClick={() => {
                  onChange(q.trim());
                  setQ("");
                }}
              >
                + Adicionar “{q.trim()}”
              </Chip>
            )}
          </div>
        </div>
      )}
    </Field>
  );
}

function NotesField({
  token,
  value,
  presets,
  onChange,
  onPreset,
}: {
  token: string;
  value: string | null;
  presets: string[];
  onChange: (v: string | null) => void;
  onPreset: (t: string) => void;
}) {
  const lines = (value ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const [draft, setDraft] = useState("");
  const set = (next: string[]) => onChange(next.length ? next.join("\n") : null);
  const toggle = (t: string) =>
    set(lines.includes(t) ? lines.filter((l) => l !== t) : [...lines, t]);
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (!lines.includes(t)) set([...lines, t]);
    setDraft("");
    if (!presets.includes(t))
      addSurveyNotePreset(token, t)
        .then(() => onPreset(t))
        .catch(() => undefined);
  };
  const custom = lines.filter((l) => !presets.includes(l));
  return (
    <Field label="Observações">
      <div className="flex flex-wrap gap-2">
        {[...presets, ...custom].map((p) => (
          <Chip key={p} active={lines.includes(p)} onClick={() => toggle(p)}>
            {p}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nova observação (fica salva para as próximas)"
          maxLength={140}
          className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-4"
        />
        <Button
          variant="ghost"
          type="button"
          onClick={add}
          className="h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
        >
          Adicionar
        </Button>
      </div>
    </Field>
  );
}

function PhotoStrip({
  token,
  item,
  photos,
  propertyName,
  onAdd,
  onRemove,
}: {
  token: string;
  item: SurveyItem;
  photos: Photo[];
  propertyName: string;
  onAdd: (p: Photo) => void;
  onRemove: (id: string) => void;
}) {
  const [busy, setBusy] = useState(0);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setFailed(false);
    for (const file of Array.from(files)) {
      setBusy((b) => b + 1);
      try {
        const base64 = await watermarkPhoto(file, propertyName, stayoLogoUrl("white"));
        onAdd(await uploadSurveyPhoto({ data: { token, itemId: item.id, base64 } }));
      } catch {
        setFailed(true);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = "";
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          variant="ghost"
          type="button"
          onClick={() => input.current?.click()}
          className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/40 bg-background text-xs font-semibold text-primary"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />} Foto
        </Button>
        {photos.map((p) => (
          <div
            key={p.id}
            className="group relative size-20 shrink-0 overflow-hidden rounded-xl border"
          >
            <a href={p.url} target="_blank" rel="noreferrer">
              <img src={p.url} alt="" className="size-full object-cover" />
            </a>
            <Button
              variant="ghost"
              type="button"
              aria-label="Remover foto"
              onClick={() =>
                deleteSurveyPhoto({ data: { token, photoId: p.id } }).then(() => onRemove(p.id))
              }
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/90 text-destructive shadow"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {failed
          ? "Uma foto não foi enviada. Tente de novo."
          : `As fotos saem com a logo, ${propertyName} e “${surveyStickerText()}”.`}
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
}
