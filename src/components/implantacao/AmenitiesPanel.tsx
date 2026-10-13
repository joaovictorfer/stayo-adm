import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ImageIcon, Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AnswerBtn, type InventoryRoomSlot } from "./ficha/FichaImplantacao";
import { matchingInventoryItem, amenityDisplayKey } from "@/lib/inventory-amenities-view";
import { Switch } from "@/components/ui/switch";
import {
  ROOM_KIND_LABEL,
  ROOM_SECTIONS,
  defaultRooms,
  reconcileRooms,
  roomProgress,
  toggleSuite,
  type Composition,
  uid,
  type AmenitiesData,
  type CustomItem,
  type ItemDef,
  type ItemState,
  type RoomKind,
  type RoomState,
  INSTALL_ROWS,
  hasInstall,
  installValue,
  setInstall,
  type InstallKey,
  type InstallField,
} from "@/lib/amenities";

import { buildSyncRows } from "@/lib/amenities-sync";
import { syncAmenitiesToInventory } from "@/lib/api/guided-inventory";

type Save = "idle" | "saving" | "saved" | "error";

async function load(implementationId: string) {
  const [a, cat, det] = await Promise.all([
    supabase.from("implementation_amenities").select("data").eq("implementation_id", implementationId).maybeSingle(),
    supabase.from("supplier_catalog").select("id,name,status").neq("status", "archived").order("name"),
    supabase.from("implementation_property_details").select("bathrooms,lavatories").eq("implementation_id", implementationId).maybeSingle(),
  ]);
  if (a.error) throw a.error;
  if (cat.error) throw cat.error;
  return {
    data: (a.data?.data ?? null) as AmenitiesData | null,
    bathrooms: det.data?.bathrooms ?? null,
    lavatories: det.data?.lavatories ?? null,
    catalog: (cat.data ?? []).map((c) => c.name as string) };
}

export function AmenitiesPanel({
  implementationId,
  bedrooms,
  bathrooms,
  render,
}: {
  implementationId: string;
  bedrooms: number | null | undefined;
  bathrooms?: number | null;
  /** Modo integrado: composição no topo e ambientes entregues por aba ao inventário. */
  render?: (slot: InventoryRoomSlot) => ReactNode;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["amenities", implementationId], queryFn: () => load(implementationId) });
  const [data, setData] = useState<AmenitiesData | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [save, setSave] = useState<Save>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<AmenitiesData | null>(null);

  useEffect(() => {
    if (q.data && data === null) {
      const d = q.data.data?.rooms?.length
        ? q.data.data
        : { rooms: defaultRooms(bedrooms, q.data.bathrooms ?? bathrooms, q.data.lavatories) };
      setData(d);
      latest.current = d;
    }
  }, [q.data, data, bedrooms, bathrooms]);

  const persist = async () => {
    if (!latest.current) return;
    setSave("saving");
    const { error } = await supabase
      .from("implementation_amenities")
      .upsert({ implementation_id: implementationId, data: latest.current as never });
    if (error) return setSave("error");
    try {
      await syncAmenitiesToInventory(implementationId, buildSyncRows(latest.current));
      void qc.invalidateQueries({ queryKey: ["guided-inventory", implementationId] });
      setSave("saved");
    } catch {
      setSave("error");
    }
  };

  const update = (fn: (d: AmenitiesData) => AmenitiesData) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      latest.current = next;
      return next;
    });
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 700);
  };

  const updateRoom = (id: string, fn: (r: RoomState) => RoomState) =>
    update((d) => ({ rooms: d.rooms.map((r) => (r.id === id ? fn(r) : r)) }));

  const addCompany = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    await supabase.from("supplier_catalog").insert({ name: clean, specialties: ["moveis"], status: "suggested" });
    void qc.invalidateQueries({ queryKey: ["amenities", implementationId] });
  };

  const [comp, setComp] = useState<Composition | null>(null);
  useEffect(() => {
    if (q.data && data && !comp) {
      const r = data.rooms;
      setComp({
        bedrooms: bedrooms ?? r.filter((x) => x.kind === "quarto").length,
        bathrooms: q.data.bathrooms ?? r.filter((x) => x.kind === "banheiro" || x.suite).length,
        lavatories: q.data.lavatories ?? r.filter((x) => x.kind === "lavabo").length,
      });
    }
  }, [q.data, data, comp, bedrooms]);

  const changeComp = async (next: Composition) => {
    setComp(next);
    update((d) => ({ rooms: reconcileRooms(d.rooms, next) }));
    const [p1, p2] = await Promise.all([
      supabase.from("implementation_projects").update({ bedrooms: next.bedrooms }).eq("id", implementationId),
      supabase
        .from("implementation_property_details")
        .upsert({ implementation_id: implementationId, bathrooms: next.bathrooms, lavatories: next.lavatories }),
    ]);
    if (p1.error || p2.error) setSave("error");
    else {
      void qc.invalidateQueries({ queryKey: ["implementation", implementationId] });
      void qc.invalidateQueries({ queryKey: ["implementation-bedrooms", implementationId] });
    }
  };

  if (q.isPending || !data)
    return q.isError ? (
      <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--stayo-border)" }}>
        Não foi possível abrir as comodidades.{" "}
        <Button variant="link" className="h-auto p-0" onClick={() => void q.refetch()}>
          Tentar de novo
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 p-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );

  const catalog = q.data?.catalog ?? [];

  const card = (room: RoomState, forceOpen = false) => (
    <RoomCard
      key={room.id}
      room={room}
      open={forceOpen ? open !== `closed:${room.id}` : open === room.id}
      onToggle={() =>
        forceOpen
          ? setOpen(open === `closed:${room.id}` ? null : `closed:${room.id}`)
          : setOpen(open === room.id ? null : room.id)
      }
      onChange={(fn) => updateRoom(room.id, fn)}
      onSuite={(on) =>
        update((d) => {
          const rooms = d.rooms.map((r) => (r.id === room.id ? toggleSuite(r, on) : r));
          return { rooms: comp ? reconcileRooms(rooms, comp) : rooms };
        })
      }
      onRemove={() => update((d) => ({ rooms: d.rooms.filter((r) => r.id !== room.id) }))}
      onInstall={(k, f, v) => update((d) => ({ rooms: setInstall(d.rooms, room.id, k, f, v) }))}
      catalog={catalog}
      onNewCompany={addCompany}
    />
  );

  const addRoom = (
    <AddRoom
      onAdd={(kind, name) => {
        const id = uid();
        update((d) => ({ rooms: [...d.rooms, { id, kind, name, items: {}, custom: [] }] }));
        setOpen(id);
      }}
      bedroomsCount={data.rooms.filter((r) => r.kind === "quarto").length}
    />
  );

  if (render) {
    const quartos = data.rooms.filter((r) => r.kind === "quarto");
    const slot: InventoryRoomSlot = (tab, inventoryItems, renderItem) => {
      let rs: RoomState[] = [];
      if (tab.startsWith("quarto")) {
        const r = quartos[Number(tab.slice(6)) - 1];
        rs = r ? [r] : [];
      } else {
        const kinds: Record<string, RoomKind[]> = {
          cozinha: ["cozinha"], sala: ["sala"], banheiro: ["banheiro", "lavabo"],
          lavanderia: ["servico"], outros: ["geral", "externa", "outro"],
        };
        rs = data.rooms.filter((r) => (kinds[tab] ?? []).includes(r.kind));
      }
      const used = new Set<string>();
      const rows: ReactNode[] = [];
      for (const room of rs) {
        const definitions = ROOM_SECTIONS[room.kind].flatMap((section) => section.items);
        const installs = hasInstall(room.kind) ? INSTALL_ROWS : [];
        const allDefs = [...definitions];
        for (const install of installs) {
          if (!allDefs.some((def) => amenityDisplayKey(def.label) === amenityDisplayKey(install.label))) {
            allDefs.push({ key: install.key === "ar" ? "ar_condicionado" : install.key === "aquecimento" ? "aquecedor" : "moveis", label: install.label });
          }
        }
        for (const def of allDefs) {
          const match = matchingInventoryItem(inventoryItems.filter((item) => !used.has(item.id) && item.category !== "Comodidades"), def.label);
          const install = installs.find((entry) => amenityDisplayKey(entry.label) === amenityDisplayKey(def.label));
          const fields = (
            <div key={`${room.id}:${def.key}`} className="space-y-4">
              {rs.length > 1 && <p className="text-sm font-medium text-foreground">{room.name}</p>}
              {install && <InstallationFields room={room} installKey={install.key} label={install.label} catalog={catalog} onChange={(field, value) => update((d) => ({ rooms: setInstall(d.rooms, room.id, install.key, field, value) }))} onNewCompany={addCompany} />}
              {!match && !install && <ItemRow def={def} items={room.items} setItem={(key, patch) => updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [key]: { ...r.items[key], ...patch } } }))} fieldsOnly />}
            </div>
          );
          if (match) {
            used.add(match.id);
            rows.push(renderItem(match, fields, !!install));
          } else {
            rows.push(<ItemRow key={`${room.id}:${def.key}`} def={def} items={room.items} setItem={(key, patch) => updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [key]: { ...r.items[key], ...patch } } }))} unified extraFields={install ? fields : undefined} installationSummary={install ? [installValue(room, install.key, "brand"), installValue(room, install.key, "installer")].filter(Boolean).join(" · ") : ""} />);
          }
        }
        for (const custom of room.custom) {
          const match = matchingInventoryItem(inventoryItems.filter((item) => !used.has(item.id) && item.category !== "Comodidades"), custom.name);
          if (match) { used.add(match.id); rows.push(renderItem(match)); }
          else rows.push(<ItemRow key={custom.id} def={{ key: custom.id, label: custom.name }} items={{ [custom.id]: custom }} setItem={(_key, patch) => updateRoom(room.id, (r) => ({ ...r, custom: r.custom.map((item) => item.id === custom.id ? { ...item, ...patch } : item) }))} unified />);
        }
        if (room.suite && room.bath) {
          for (const def of ROOM_SECTIONS.banheiro.flatMap((section) => section.items)) {
            rows.push(<ItemRow key={`${room.id}:bath:${def.key}`} def={{ ...def, label: `${def.label} · Banheiro da suíte` }} items={room.bath.items} setItem={(key, patch) => updateRoom(room.id, (r) => r.bath ? ({ ...r, bath: { ...r.bath, items: { ...r.bath.items, [key]: { ...r.bath.items[key], ...patch } } } }) : r)} unified />);
          }
        }
      }
      // Synced amenity rows are represented by their editable source above, not twice.
      rows.push(...inventoryItems.filter((item) => !used.has(item.id) && item.category !== "Comodidades").map((item) => renderItem(item)));
      return <>
        {rows}
        <li className="flex flex-wrap items-center justify-between gap-2 px-2 py-3">
          {tab === "outros" ? addRoom : <span />}
          <SaveBadge state={save} onRetry={() => void persist()} />
        </li>
      </>;
    };
    return (
      <div className="flex flex-col gap-4">
        {comp && (
          <section className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--stayo-border)" }}>
            <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--stayo-navy)" }}>Composição do imóvel</h3>
            <CompositionBar value={comp} onChange={(c) => void changeComp(c)} />
          </section>
        )}
        {render(slot)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Abra cada ambiente e marque o que o imóvel tem.
        </p>
        <SaveBadge state={save} onRetry={() => void persist()} />
      </div>
      {comp && <CompositionBar value={comp} onChange={(c) => void changeComp(c)} />}
      {data.rooms.map((room) => card(room))}
      {addRoom}
    </div>
  );
}

export function AmenitiesSummary({ implementationId }: { implementationId: string }) {
  const q = useQuery({ queryKey: ["amenities", implementationId], queryFn: () => load(implementationId) });
  const rooms = q.data?.data?.rooms ?? [];
  if (!rooms.length) return <>Nada marcado ainda</>;
  const marked = rooms.reduce((n, r) => n + roomProgress(r).marked, 0);
  return <>{`${marked} ${marked === 1 ? "item marcado" : "itens marcados"} em ${rooms.length} ${rooms.length === 1 ? "ambiente" : "ambientes"}`}</>;
}

function SaveBadge({ state, onRetry }: { state: Save; onRetry: () => void }) {
  if (state === "idle") return null;
  if (state === "saving")
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        <Loader2 className="size-3 animate-spin" /> Salvando…
      </span>
    );
  if (state === "error")
    return (
      <button className="text-xs underline" style={{ color: "var(--stayo-danger)" }} onClick={onRetry}>
        Não salvou · tentar de novo
      </button>
    );
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--stayo-success)" }}>
      <Check className="size-3" /> Salvo
    </span>
  );
}

function RoomCard({
  room,
  open,
  onToggle,
  onChange,
  onRemove,
  onSuite,
  catalog,
  onNewCompany,
  onInstall,
}: {
  onInstall: (k: InstallKey, f: InstallField, v: string) => void;
  onSuite: (on: boolean) => void;
  room: RoomState;
  open: boolean;
  onToggle: () => void;
  onChange: (fn: (r: RoomState) => RoomState) => void;
  onRemove: () => void;
  catalog: string[];
  onNewCompany: (name: string) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(room.name);
  const p = roomProgress(room);
  const setItem = (key: string, patch: Partial<ItemState>) =>
    onChange((r) => ({ ...r, items: { ...r.items, [key]: { ...r.items[key], ...patch } } }));

  return (
    <section className="rounded-[var(--radius-card)] border bg-white" style={{ borderColor: "var(--stayo-border)" }}>
      <div className="flex items-center gap-2 p-3">
        {renaming ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onChange((r) => ({ ...r, name: name.trim() }));
              setRenaming(false);
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8" />
            <Button size="sm" type="submit">OK</Button>
          </form>
        ) : (
          <button className="flex flex-1 items-center gap-2 text-left" onClick={onToggle} aria-expanded={open}>
            <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            <span className="font-semibold">{room.name}</span>
            <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {p.marked} marcado{p.marked === 1 ? "" : "s"}
            </span>
          </button>
        )}
        {!renaming && room.kind === "quarto" && (
          <button
            onClick={() => onSuite(!room.suite)}
            aria-pressed={!!room.suite}
            className="rounded-full border px-3 py-1 text-xs font-medium"
            style={{
              borderColor: room.suite ? "var(--stayo-forest)" : "var(--stayo-border)",
              backgroundColor: room.suite ? "var(--stayo-forest-soft)" : "white",
            }}
          >
            {room.suite ? "✓ Suíte" : "Suíte"}
          </button>
        )}
        {!renaming && (
          <>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Renomear ambiente" onClick={() => setRenaming(true)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Remover ambiente"
              onClick={() => window.confirm(`Remover "${room.name}" e tudo que foi marcado nele?`) && onRemove()}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t p-3" style={{ borderColor: "var(--stayo-border)" }}>
          {hasInstall(room.kind) && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
                Equipamentos e instalações
              </h4>
              <p className="mb-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                O que você preencher aqui vale para todos os ambientes; ajuste em cada um se for diferente.
              </p>
              <datalist id={`fornecedores-${room.id}`}>
                {catalog.map((c) => <option key={c} value={c} />)}
              </datalist>
              <div className="flex flex-col gap-1.5">
                {INSTALL_ROWS.map((row) => (
                  <div key={row.key} className="grid items-center gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[8rem_1fr_1fr]" style={{ borderColor: "var(--stayo-border)" }}>
                    <span className="text-sm font-medium">{row.label}</span>
                    <Input
                      placeholder="Marca"
                      aria-label={`${row.label} — marca`}
                      value={installValue(room, row.key, "brand")}
                      onChange={(e) => onInstall(row.key, "brand", e.target.value)}
                      className="h-9"
                    />
                    <Input
                      placeholder="Instalador / fornecedor"
                      aria-label={`${row.label} — instalador`}
                      list={`fornecedores-${room.id}`}
                      value={installValue(room, row.key, "installer")}
                      onChange={(e) => onInstall(row.key, "installer", e.target.value)}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (row.key === "moveis" && v && !catalog.includes(v)) void onNewCompany(v);
                      }}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {ROOM_SECTIONS[room.kind].map((s) => (
            <div key={s.title}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
                {s.title}
              </h4>
              <div className="flex flex-col gap-1.5">
                {s.items.map((def) => (
                  <ItemRow key={def.key} def={def} items={room.items} setItem={setItem} />
                ))}
              </div>
            </div>
          ))}

          <CustomItems
            items={room.custom}
            onChange={(custom) => onChange((r) => ({ ...r, custom }))}
          />

          {room.suite && room.bath && (
            <div className="flex flex-col gap-3 rounded-lg border-l-4 pl-3" style={{ borderColor: "var(--stayo-forest)" }}>
              <h4 className="text-sm font-semibold">Banheiro da suíte</h4>
              <CompanyPicker
                label="Móveis do banheiro"
                value={room.bath.furnitureSupplier ?? ""}
                catalog={catalog}
                onChange={(v) => onChange((r) => ({ ...r, bath: { ...r.bath!, furnitureSupplier: v || null } }))}
                onNew={onNewCompany}
              />
              <div className="flex flex-col gap-1.5">
                {ROOM_SECTIONS.banheiro.flatMap((s) => s.items).map((def) => (
                  <ItemRow
                    key={def.key}
                    def={def}
                    items={room.bath!.items}
                    setItem={(key, patch) =>
                      onChange((r) => ({
                        ...r,
                        bath: { ...r.bath!, items: { ...r.bath!.items, [key]: { ...r.bath!.items[key], ...patch } } },
                      }))
                    }
                  />
                ))}
              </div>
              <CustomItems
                items={room.bath.custom}
                onChange={(custom) => onChange((r) => ({ ...r, bath: { ...r.bath!, custom } }))}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InstallationFields({ room, installKey, label, catalog, onChange, onNewCompany }: { room: RoomState; installKey: InstallKey; label: string; catalog: string[]; onChange: (field: InstallField, value: string) => void; onNewCompany: (value: string) => Promise<void> }) {
  return <div className="space-y-3">
    <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Marca · {label}</span><Input value={installValue(room, installKey, "brand")} aria-label={`${label} — marca`} onChange={(e) => onChange("brand", e.target.value)} /></label>
    <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Instalador / fornecedor</span><Input list={`integrated-suppliers-${room.id}`} value={installValue(room, installKey, "installer")} aria-label={`${label} — instalador`} onChange={(e) => onChange("installer", e.target.value)} onBlur={(e) => { const value = e.target.value.trim(); if (installKey === "moveis" && value && !catalog.includes(value)) void onNewCompany(value); }} /></label>
    <datalist id={`integrated-suppliers-${room.id}`}>{catalog.map((name) => <option key={name} value={name} />)}</datalist>
  </div>;
}

function ItemRow({
  def,
  items,
  setItem,
  nested,
  unified,
  fieldsOnly,
  extraFields,
  hideBrand,
  installationSummary,
}: {
  installationSummary?: string;
  hideBrand?: boolean;
  unified?: boolean;
  fieldsOnly?: boolean;
  extraFields?: ReactNode;
  def: ItemDef;
  items: Record<string, ItemState>;
  setItem: (key: string, patch: Partial<ItemState>) => void;
  nested?: boolean;
}) {
  const st = items[def.key] ?? {};
  const [details, setDetails] = useState(false);
  const on = fieldsOnly || !!st.on;
  if (unified) return (
    <li className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-border px-2 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]" data-testid="amenity-inventory-row">
      <Button variant="ghost" className="size-12 rounded-lg bg-muted p-0 sm:size-14" aria-label={`Detalhes de ${def.label}`} onClick={() => setDetails(true)}><ImageIcon className="text-muted-foreground" /></Button>
      <Button variant="ghost" className="h-auto min-w-0 flex-col items-start gap-0 whitespace-normal p-0 text-left hover:bg-transparent" onClick={() => setDetails(true)}>
        <span className="font-semibold text-foreground">{def.label}</span>
        <span className="text-xs font-normal text-muted-foreground sm:text-sm">{installationSummary || summary(st, def) || (st.on === undefined ? "Ainda não respondido" : st.on ? "STAYO · Disponível" : "STAYO · Não disponível")}</span>
      </Button>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1" role="radiogroup" aria-label={`Resposta para ${def.label}`}>
        <AnswerBtn kind="no" on={st.on === false} onClick={() => setItem(def.key, { on: false })} />
        <AnswerBtn kind="yes" on={st.on === true} onClick={() => { setItem(def.key, { on: true }); if (extraFields) setDetails(true); }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" className="h-10 w-11 shrink-0 rounded-lg p-0" aria-label={`Mais ações para ${def.label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDetails(true)}>Detalhes</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDetails(true)}>{extraFields ? "Marca e instalador" : "Marca e observação"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Sheet open={details} onOpenChange={setDetails}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{def.label}</SheetTitle></SheetHeader>
          <div className="mt-5 space-y-4">{extraFields ?? <ItemRow def={def} items={items} setItem={setItem} fieldsOnly />}</div>
        </SheetContent>
      </Sheet>
    </li>
  );
  return (
    <div
      className={fieldsOnly ? "space-y-3" : `rounded-lg border ${nested ? "bg-white" : ""}`}
      style={{ borderColor: on ? "var(--stayo-forest)" : "var(--stayo-border)", backgroundColor: on && !nested ? "var(--stayo-bg)" : undefined }}
    >
      {!fieldsOnly && <div className="flex min-h-11 items-center gap-3 px-3 py-2">
        <Switch checked={on} onCheckedChange={(v) => setItem(def.key, { on: v })} aria-label={def.label} />
        <span className="flex-1 text-sm font-medium">{def.label}</span>
        {on && !def.sub && (
          <button className="text-xs underline" style={{ color: "var(--stayo-ink-muted)" }} onClick={() => setDetails((d) => !d)}>
            {details ? "Fechar" : summary(st, def) || "Detalhes"}
          </button>
        )}
      </div>}

      {on && def.options && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {def.options.map((o) => {
            const n = st.opts?.[o] ?? 0;
            return (
              <div
                key={o}
                className="flex items-center gap-1 rounded-full border px-1 py-0.5 text-sm"
                style={{ borderColor: n ? "var(--stayo-forest)" : "var(--stayo-border)", backgroundColor: n ? "var(--stayo-forest-soft)" : "white" }}
              >
                <button
                  className="px-2"
                  onClick={() => setItem(def.key, { opts: { ...st.opts, [o]: n ? 0 : 1 } })}
                  aria-pressed={!!n}
                >
                  {o}
                </button>
                {n > 0 && (
                  <>
                    <button className="size-6 rounded-full" aria-label={`Menos ${o}`} onClick={() => setItem(def.key, { opts: { ...st.opts, [o]: n - 1 } })}>−</button>
                    <span className="w-4 text-center tabular-nums">{n}</span>
                    <button className="size-6 rounded-full" aria-label={`Mais ${o}`} onClick={() => setItem(def.key, { opts: { ...st.opts, [o]: n + 1 } })}>+</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {on && def.company && (
        <div className="px-3 pb-2">
          <Input
            placeholder="Empresa responsável"
            value={st.company ?? ""}
            onChange={(e) => setItem(def.key, { company: e.target.value })}
            className="h-9"
          />
        </div>
      )}

      {on && (details || fieldsOnly) && (
        <div className={fieldsOnly ? "grid gap-3" : "grid gap-2 px-3 pb-3 sm:grid-cols-3"}>
          {!def.options && (
            <Input
              type="number"
              min={0}
              placeholder="Quantidade"
              aria-label="Quantidade"
              value={st.qty ?? ""}
              onChange={(e) => setItem(def.key, { qty: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-9"
            />
          )}
          {!hideBrand && <Input placeholder="Marca" aria-label="Marca" value={st.brand ?? ""} onChange={(e) => setItem(def.key, { brand: e.target.value })} className="h-9" />}
          <Input
            placeholder="Observação"
            aria-label="Observação"
            value={st.notes ?? ""}
            onChange={(e) => setItem(def.key, { notes: e.target.value })}
            className="h-9 sm:col-span-1"
          />
        </div>
      )}

      {on && def.sub && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {def.sub.map((s) => (
            <ItemRow key={s.key} def={s} items={items} setItem={setItem} nested />
          ))}
        </div>
      )}
    </div>
  );
}

function summary(st: ItemState, def: ItemDef) {
  return [!def.options && st.qty ? `${st.qty} un.` : "", st.brand, st.notes ? "obs." : ""].filter(Boolean).join(" · ");
}

function CustomItems({ items, onChange }: { items: CustomItem[]; onChange: (c: CustomItem[]) => void }) {
  const set = (id: string, patch: Partial<CustomItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div>
      {items.length > 0 && (
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
          Outros itens
        </h4>
      )}
      <div className="flex flex-col gap-2">
        {items.map((i) => (
          <div key={i.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[2fr_80px_1fr_1fr_1.5fr_auto]" style={{ borderColor: "var(--stayo-border)" }}>
            <Input placeholder="Nome do item" value={i.name} onChange={(e) => set(i.id, { name: e.target.value })} className="h-9" />
            <Input type="number" min={0} placeholder="Qtd" value={i.qty ?? ""} onChange={(e) => set(i.id, { qty: e.target.value === "" ? null : Number(e.target.value) })} className="h-9" />
            <Input placeholder="Marca" value={i.brand ?? ""} onChange={(e) => set(i.id, { brand: e.target.value })} className="h-9" />
            <Input placeholder="Fornecedor" value={i.supplier ?? ""} onChange={(e) => set(i.id, { supplier: e.target.value })} className="h-9" />
            <Input placeholder="Observação" value={i.notes ?? ""} onChange={(e) => set(i.id, { notes: e.target.value })} className="h-9" />
            <Button variant="ghost" size="icon" className="size-9" aria-label="Remover item" onClick={() => onChange(items.filter((x) => x.id !== i.id))}>
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => onChange([...items, { id: uid(), name: "", on: true, qty: 1 }])}>
        <Plus /> Adicionar outro item
      </Button>
    </div>
  );
}

function CompanyPicker({
  label,
  value,
  catalog,
  onChange,
  onNew,
}: {
  label: string;
  value: string;
  catalog: string[];
  onChange: (v: string) => void;
  onNew: (name: string) => Promise<void>;
}) {
  const [other, setOther] = useState(false);
  const [text, setText] = useState("");
  const options = value && !catalog.includes(value) ? [value, ...catalog] : catalog;
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--stayo-bg)" }}>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {other ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            await onNew(text);
            onChange(text.trim());
            setOther(false);
            setText("");
          }}
        >
          <Input autoFocus placeholder="Nome da empresa" value={text} onChange={(e) => setText(e.target.value)} className="h-9 bg-white" />
          <Button size="sm" type="submit">Salvar</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setOther(false)}>Cancelar</Button>
        </form>
      ) : (
        <select
          className="h-9 w-full rounded-md border bg-white px-2 text-sm"
          style={{ borderColor: "var(--stayo-border)" }}
          value={value}
          onChange={(e) => (e.target.value === "__other" ? setOther(true) : onChange(e.target.value))}
        >
          <option value="">Não informado</option>
          {options.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value="__other">+ Outra empresa…</option>
        </select>
      )}
    </div>
  );
}

function AddRoom({ onAdd, bedroomsCount }: { onAdd: (k: RoomKind, name: string) => void; bedroomsCount: number }) {
  const [open, setOpen] = useState(false);
  const kinds: RoomKind[] = ["quarto", "banheiro", "lavabo", "sala", "cozinha", "servico", "externa", "outro"];
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus /> Adicionar ambiente
      </Button>
    );
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border p-3" style={{ borderColor: "var(--stayo-border)" }}>
      {kinds.map((k) => (
        <Button
          key={k}
          size="sm"
          variant="outline"
          onClick={() => {
            onAdd(k, k === "quarto" ? `Quarto ${String(bedroomsCount + 1).padStart(2, "0")}` : ROOM_KIND_LABEL[k]);
            setOpen(false);
          }}
        >
          {ROOM_KIND_LABEL[k]}
        </Button>
      ))}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
    </div>
  );
}

function CompositionBar({ value, onChange }: { value: Composition; onChange: (c: Composition) => void }) {
  const fields: [keyof Composition, string, number][] = [
    ["bedrooms", "Quartos", 1],
    ["bathrooms", "Banheiros", 1],
    ["lavatories", "Lavabos", 0],
  ];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-card)] border bg-white p-3" style={{ borderColor: "var(--stayo-border)" }}>
      {fields.map(([k, label, min]) => (
        <div key={k} className="flex flex-col items-center gap-1">
          <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{label}</span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={`Menos ${label}`}
              disabled={value[k] <= min}
              onClick={() => onChange({ ...value, [k]: value[k] - 1 })}
            >
              −
            </Button>
            <span className="w-5 text-center text-base font-semibold tabular-nums">{value[k]}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={`Mais ${label}`}
              onClick={() => onChange({ ...value, [k]: value[k] + 1 })}
            >
              +
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
