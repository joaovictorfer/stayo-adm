import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ImageIcon, Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InventoryDetailLayout } from "./guide/InventoryDetailLayout";
import { InventoryDetailFields } from "./guide/InventoryDetailFields";
import type { InventoryCondition } from "@/lib/guided-inventory";
import { inventorySubItemsFor } from "@/lib/inventory-subitems";
import { InventoryRow } from "./ficha/InventoryRow";
import { AnswerBtn, type InventoryRoomSlot } from "./ficha/FichaImplantacao";
import { matchingInventoryItem, amenityDisplayKey } from "@/lib/inventory-amenities-view";
import { inventoryReferenceFor, loadInventoryReferenceMedia } from "@/lib/api/inventory-reference-media";
import { Switch } from "@/components/ui/switch";
import { inventoryCharacteristic } from "@/lib/inventory-characteristics";
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
  setInstallationAnswer,
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
  group,
}: {
  /** Implantação completa: só utensílios (sem fornecedores) ou só fornecedores e equipamentos. */
  group?: "utensilios" | "fornecedores" | undefined;
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
    void qc.invalidateQueries({ queryKey: ["property-details", implementationId] });
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

  const catalogRef = useRef<string[]>([]);
  const updateRoom = (id: string, fn: (r: RoomState) => RoomState) =>
    update((d) => ({ rooms: d.rooms.map((r) => (r.id === id ? fn(r) : r)) }));

  const addCompany = async (name: string, specialty: string = "moveis") => {
    const clean = name.trim();
    if (!clean) return;
    if (catalogRef.current.some((n) => n.toLowerCase() === clean.toLowerCase())) return;
    await supabase.from("supplier_catalog").insert({ name: clean, specialties: [specialty], status: "suggested" });
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
  // Ajusta os ambientes à composição salva (ex.: 2 banheiros → 2 abas), sem apagar nada marcado.
  const reconciled = useRef(false);
  useEffect(() => {
    if (!comp || !data || reconciled.current) return;
    reconciled.current = true;
    const next = reconcileRooms(data.rooms, comp);
    if (next.length !== data.rooms.length) update(() => ({ rooms: next }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp, data]);
  useEffect(() => {
    void 0;
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
  catalogRef.current = catalog;

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
    const banheiros = data.rooms.filter((r) => r.kind === "banheiro");
    const lavabos = data.rooms.filter((r) => r.kind === "lavabo");
    const setSuite = (roomId: string, on: boolean) =>
      update((d) => {
        const rooms = d.rooms.map((r) => (r.id === roomId ? toggleSuite(r, on) : r));
        return { rooms: comp ? reconcileRooms(rooms, comp) : rooms };
      });
    const slot: InventoryRoomSlot = (tab, inventoryItems, renderItem) => {
      let rs: RoomState[] = [];
      if (tab.startsWith("quarto")) {
        const r = quartos[Number(tab.slice(6)) - 1];
        rs = r ? [r] : [];
      } else if (tab.startsWith("banheiro")) {
        const r = banheiros[Number(tab.slice(8) || 1) - 1];
        rs = r ? [r] : [];
      } else if (tab.startsWith("lavabo")) {
        const r = lavabos[Number(tab.slice(6)) - 1];
        rs = r ? [r] : [];
      } else {
        const kinds: Record<string, RoomKind[]> = {
          cozinha: ["cozinha"], sala: ["sala"],
          lavanderia: ["servico"], outros: ["geral", "externa", "outro"],
        };
        rs = data.rooms.filter((r) => (kinds[tab] ?? []).includes(r.kind));
      }
      const used = new Set<string>();
      const rows: ReactNode[] = [];
      const supplierAll: ReactNode[] = [];
      const bedroom = tab.startsWith("quarto") ? rs[0] : undefined;
      if (bedroom) {
        const totalBaths = comp?.bathrooms ?? 0;
        const suites = quartos.filter((r) => r.suite).length;
        const canLink = bedroom.suite || suites < totalBaths;
        rows.push(
          <li key={`${bedroom.id}:suite`} className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3" style={{ borderColor: "var(--stayo-border)" }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--stayo-navy)" }}>{bedroom.suite ? "Suíte com banheiro privativo" : "Banheiro vinculado"}</p>
              <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {bedroom.suite ? "Os itens do banheiro deste quarto aparecem logo abaixo." : canLink ? "Marque se este quarto tem banheiro próprio." : "Todos os banheiros já estão vinculados. Aumente o número de banheiros no topo."}
              </p>
            </div>
            <Button type="button" size="sm" variant={bedroom.suite ? "default" : "outline"} disabled={!canLink} aria-pressed={!!bedroom.suite} onClick={() => setSuite(bedroom.id, !bedroom.suite)}>
              {bedroom.suite ? "✓ É suíte" : "Vincular banheiro"}
            </Button>
          </li>,
        );
      }
      if (tab.startsWith("banheiro") && tab === "banheiro1") {
        const linked = quartos.filter((r) => r.suite);
        if (linked.length) rows.push(
          <li key="suite-note" className="border-b px-3 py-2.5 text-xs" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}>
            {linked.length === 1 ? "Banheiro da suíte" : "Banheiros das suítes"} ({linked.map((r) => r.name).join(", ")}) {linked.length === 1 ? "fica" : "ficam"} dentro do próprio quarto.
          </li>,
        );
      }
      for (const room of rs) {
        const supplierRows: ReactNode[] = [];
        const definitions = tab === "outros" ? ROOM_SECTIONS[room.kind].flatMap((section) => section.items).filter((def) => room.items[def.key]?.on !== undefined) : ROOM_SECTIONS[room.kind].flatMap((section) => section.items);
        const installs = hasInstall(room.kind) ? INSTALL_ROWS : [];
        const allDefs = [...definitions];
        for (const install of installs) {
          if (!allDefs.some((def) => amenityDisplayKey(def.label) === amenityDisplayKey(install.label))) {
            allDefs.push({ key: install.key === "ar" ? "ar_condicionado" : install.key === "aquecimento" ? "aquecedor" : "moveis", label: install.label });
          }
        }
        for (const def of allDefs) {
          const isGroup = !!def.subAnswers && !!def.sub;
          const free = inventoryItems.filter((item) => !used.has(item.id));
          // Espelho de sincronização (categoria "Comodidades") entra só como último recurso,
          // quando o item real do guia não existe — mantém a linha unificada com foto e detalhes.
          const match = isGroup
            ? null
            : matchingInventoryItem(free.filter((item) => item.category !== "Comodidades"), def.label) ??
              matchingInventoryItem(free.filter((item) => item.category === "Comodidades" && item.enabled), def.label);
          const install = installs.find((entry) => amenityDisplayKey(entry.label) === amenityDisplayKey(def.label));
          const groupSubs: ReactNode[] = [];
          let groupItems = room.items;
          if (isGroup && def.sub) {
            if (match) used.add(match.id);
            const pool = inventoryItems.filter((item) => !used.has(item.id) && item.category !== "Comodidades");
            for (const child of def.sub) {
              const cm = matchingInventoryItem(pool, child.label);
              if (cm) {
                used.add(cm.id);
                if (groupItems[child.key]?.on === undefined && cm.inventory_answer) {
                  groupItems = { ...groupItems, [child.key]: { ...groupItems[child.key], on: cm.inventory_answer === "tenho" } };
                }
                groupSubs.push(renderItem(cm));
              } else {
                groupSubs.push(
                  <ItemRow
                    key={`${room.id}:${def.key}:${child.key}`}
                    def={{ key: child.key, label: child.label }}
                    items={groupItems}
                    setItem={(key, patch) => updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [key]: { ...r.items[key], ...patch } } }))}
                    unified
                  />,
                );
              }
            }
          }
          const fields = (
            <div key={`${room.id}:${def.key}`} className="space-y-4">
              {rs.length > 1 && <p className="text-sm font-medium text-foreground">{room.name}</p>}
              {install && <InstallationFields installKey={install.key} state={room.items[def.key] ?? {}} supplier={installValue(room, install.key, "installer")} catalog={catalog} onType={(value) => updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [def.key]: { ...r.items[def.key], characteristics: { ...r.items[def.key]?.characteristics, installType: value } } } }))} onSupplier={(value) => update((d) => ({ rooms: setInstall(d.rooms, room.id, install.key, "installer", value) }))} onNewCompany={(name) => addCompany(name, install.key)} />}
              {!install && match && <CharacteristicFields name={def.label} state={room.items[def.key] ?? {}} onChange={(patch) => updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [def.key]: { ...r.items[def.key], ...patch } } }))} />}
              {!match && !install && <ItemRow def={def} items={room.items} setItem={(key, patch) => updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [key]: { ...r.items[key], ...patch } } }))} fieldsOnly />}
            </div>
          );
          if (match && !install && !isGroup) {
            used.add(match.id);
            rows.push(renderItem(match.category === "Comodidades" ? { ...match, name: def.label } : match, fields, !!install));
          } else {
            if (match) used.add(match.id);
            const displayedItems = match && room.items[def.key]?.on === undefined && match.inventory_answer
              ? { ...room.items, [def.key]: { ...room.items[def.key], on: match.inventory_answer === "tenho" } } : room.items;
            const row = <ItemRow key={`${room.id}:${def.key}`} def={def} items={isGroup ? groupItems : displayedItems} setItem={(key, patch) => {
              if (install && patch.on !== undefined) update((d) => ({ rooms: setInstallationAnswer(d.rooms, room.id, install.key, patch.on === true) }));
              else updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [key]: { ...r.items[key], ...patch } } }));
            }} unified subNodes={isGroup ? groupSubs : undefined} extraFields={install ? fields : undefined}
              brandSlot={install ? <Input className="h-11 text-sm" value={installValue(room, install.key, "brand")} maxLength={80} placeholder="Ex.: LG" aria-label={`${install.label} — marca`} onChange={(e) => update((d) => ({ rooms: setInstall(d.rooms, room.id, install.key, "brand", e.target.value) }))} /> : undefined}
              hideQuantity={!!install && install.key !== "moveis"}
              onDuplicate={install ? (name) => updateRoom(room.id, (r) => ({ ...r, custom: [...r.custom, { id: uid(), name, on: true, brand: installValue(room, install.key, "brand"), supplier: installValue(room, install.key, "installer"), characteristics: r.items[def.key]?.characteristics ?? {} }] })) : undefined}
              installationSummary={install ? [installValue(room, install.key, "brand"), installValue(room, install.key, "installer")].filter(Boolean).join(" · ") : ""} />;
            if (install) supplierRows.push(row);
            else rows.push(row);
          }
        }
        if (supplierRows.length && group === "fornecedores") supplierAll.push(...supplierRows);
        else if (supplierRows.length && group !== "utensilios") {
          rows.push(
            <li key={`${room.id}:suppliers`} className="list-none border-b border-border py-2">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-2 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Fornecedores{rs.length > 1 ? ` · ${room.name}` : ""}</span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform duration-100 group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <ul className="ml-2 border-l-4 border-border pl-3">{supplierRows}</ul>
              </details>
            </li>,
          );
        }
        for (const custom of room.custom) {
          const match = matchingInventoryItem(inventoryItems.filter((item) => !used.has(item.id) && item.category !== "Comodidades"), custom.name);
          if (match) { used.add(match.id); rows.push(renderItem(match)); }
          else {
            const setCustom = (patch: Partial<typeof custom>) => updateRoom(room.id, (r) => ({ ...r, custom: r.custom.map((item) => item.id === custom.id ? { ...item, ...patch } : item) }));
            rows.push(<ItemRow key={custom.id} def={{ key: custom.id, label: custom.name }} items={{ [custom.id]: custom }} setItem={(_key, patch) => setCustom(patch)} unified
              onRename={(name) => setCustom({ name })}
              onDuplicate={(name) => updateRoom(room.id, (r) => ({ ...r, custom: [...r.custom, { ...custom, id: uid(), name }] }))}
              extraFields={<SupplierPicker label="Fornecedor" value={custom.supplier ?? ""} catalog={catalog} onChange={(supplier) => setCustom({ supplier })} onNewCompany={(name) => addCompany(name, "outros")} />} />);
          }
        }
        if (room.suite && room.bath) {
          const bathItems = inventoryItems.filter((item) => item.inventory_room_key === `${room.id}:bath`);
          for (const def of ROOM_SECTIONS.banheiro.flatMap((section) => section.items)) {
            const match = matchingInventoryItem(bathItems, def.label);
            if (match) { used.add(match.id); rows.push(renderItem({ ...match, name: `${match.name} · Banheiro da suíte` })); }
            else rows.push(<ItemRow key={`${room.id}:bath:${def.key}`} def={{ ...def, label: `${def.label} · Banheiro da suíte` }} items={room.bath.items} setItem={(key, patch) => updateRoom(room.id, (r) => r.bath ? ({ ...r, bath: { ...r.bath, items: { ...r.bath.items, [key]: { ...r.bath.items[key], ...patch } } } }) : r)} unified />);
          }
        }
      }
      // Synced amenity rows are represented by their editable source above, not twice.
      rows.push(...inventoryItems.filter((item) => !used.has(item.id) && item.category !== "Comodidades").map((item) => {
        const room = rs[0];
        const subFields: Record<string, ReactNode> = {};
        if (room) for (const child of inventorySubItemsFor(item.name)) {
          const st = room.items[child.key] ?? {};
          subFields[child.key] = <InventoryDetailFields values={{ name: child.label, quantity: st.qty == null ? "" : String(st.qty), brand: st.brand ?? "", condition: (st.characteristics?.['inventory_condition'] as InventoryCondition) || null, notes: st.notes ?? "" }} nameReadOnly onChange={(patch) => updateRoom(room.id, (r) => ({ ...r, items: { ...r.items, [child.key]: { ...r.items[child.key],
            ...(patch.quantity !== undefined ? { qty: patch.quantity === "" ? null : Number(patch.quantity) } : {}),
            ...(patch.brand !== undefined ? { brand: patch.brand } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            ...(patch.condition !== undefined ? { characteristics: { ...r.items[child.key]?.characteristics, inventory_condition: patch.condition ?? "" } } : {}),
          } } }))} />;
        }
        return renderItem(item, undefined, false, subFields);
      }));
      if (group === "fornecedores")
        return supplierAll.length ? <>{supplierAll}</> : <li className="list-none px-2 py-6 text-center text-sm text-muted-foreground">Nenhum fornecedor ou equipamento neste ambiente.</li>;
      return <>
        {rows}
        <li className="flex flex-wrap items-center justify-between gap-2 px-2 py-3">
          {tab === "outros" ? addRoom : <span />}
          <SaveBadge state={save} onRetry={() => void persist()} />
        </li>
      </>;
    };
    slot.bathTabs = [
      ...banheiros.map((r, i) => ({ id: `banheiro${i + 1}`, label: /^Banheiro( social)?( \d+)?$/.test(r.name) ? `Banheiro ${String(i + 1).padStart(2, "0")}` : r.name })),
      ...lavabos.map((r, i) => ({ id: `lavabo${i + 1}`, label: r.name })),
    ];
    slot.roomKeys = Object.fromEntries([
      ...quartos.map((r, i) => [`quarto${i + 1}`, [r.id, ...(r.suite ? [`${r.id}:bath`] : [])]]),
      ...banheiros.map((r, i) => [`banheiro${i + 1}`, [r.id]]),
      ...lavabos.map((r, i) => [`lavabo${i + 1}`, [r.id]]),
    ]);
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

const INSTALL_TYPES: Record<InstallKey, string[]> = {
  ar: ["Split", "Janela", "Portátil", "Piso-teto"],
  aquecimento: ["A gás", "Elétrico", "Lareira", "Piso aquecido"],
  moveis: ["Planejados", "Soltos", "Misto"],
};

function InstallationFields({ installKey, state, supplier, catalog, onType, onSupplier, onNewCompany }: { installKey: InstallKey; state: ItemState; supplier: string; catalog: string[]; onType: (value: string) => void; onSupplier: (value: string) => void; onNewCompany: (value: string) => Promise<void> }) {
  const type = state.characteristics?.installType ?? "";
  return <div className="space-y-4">
    <div className="space-y-1.5"><p className="text-sm text-muted-foreground">Tipo</p><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
      {INSTALL_TYPES[installKey].map((option) => <Button key={option} type="button" className="h-11 px-3 text-xs" variant={type === option ? "default" : "outline"} role="radio" aria-checked={type === option} onClick={() => onType(type === option ? "" : option)}>{option}</Button>)}
    </div></div>
    <SupplierPicker label="Fornecedor" value={supplier} catalog={catalog} onChange={onSupplier} onNewCompany={onNewCompany} />
  </div>;
}

function SupplierPicker({ label, value, catalog, onChange, onNewCompany }: { label: string; value: string; catalog: string[]; onChange: (value: string) => void; onNewCompany: (value: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const term = query.trim().toLowerCase();
  const matches = catalog.filter((name) => !term || name.toLowerCase().includes(term)).slice(0, 6);
  const exact = catalog.some((name) => name.toLowerCase() === term);
  const pick = (name: string) => { onChange(name); setQuery(""); setOpen(false); };
  return <div className="space-y-1.5 text-sm">
    <p className="text-muted-foreground">{label}</p>
    {value && !open ? <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-input px-3">
      <span className="truncate font-medium text-foreground">{value}</span>
      <span className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" className="h-9 px-2 text-xs" onClick={() => setOpen(true)}>Trocar</Button>
        <Button type="button" variant="ghost" className="h-9 w-9 p-0" aria-label="Remover fornecedor" onClick={() => onChange("")}><X className="size-4" /></Button>
      </span>
    </div> : <div className="space-y-1">
      <Input className="h-11 text-sm" value={query} placeholder="Buscar fornecedor" aria-label={`${label} — buscar`} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} />
      {open && <ul className="max-h-56 overflow-auto rounded-md border border-border bg-background" role="listbox" aria-label="Fornecedores cadastrados">
        {matches.map((name) => <li key={name}><button type="button" role="option" aria-selected={name === value} className="flex min-h-11 w-full items-center px-3 text-left hover:bg-muted" onClick={() => pick(name)}>{name}</button></li>)}
        {term && !exact && <li><button type="button" className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-medium text-primary hover:bg-muted" onClick={() => { const name = query.trim(); void onNewCompany(name); pick(name); }}><Plus className="size-4" /> Novo fornecedor “{query.trim()}”</button></li>}
        {!term && !matches.length && <li className="px-3 py-3 text-muted-foreground">Digite o nome para cadastrar</li>}
      </ul>}
    </div>}
  </div>;
}

function CharacteristicFields({ name, state, onChange }: { name: string; state: ItemState; onChange: (patch: Partial<ItemState>) => void }) {
  const field = inventoryCharacteristic(name);
  if (!field) return null;
  const value = state.characteristics?.[field.key] ?? "";
  const change = (next: string) => onChange({ characteristics: { ...state.characteristics, [field.key]: next } });
  return <div className="space-y-2">
    <p className="text-sm text-muted-foreground">{field.label}</p>
    {field.options ? <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={field.label}>
      {field.options.map((option) => <Button key={option} type="button" variant={value === option ? "default" : "outline"} role="radio" aria-checked={value === option} onClick={() => change(option)}>{option}</Button>)}
    </div> : <Input type="number" min={1} step={1} aria-label={field.label} value={value} onChange={(e) => { const next = e.target.value; if (!next || (Number.isInteger(Number(next)) && Number(next) >= 1)) change(next); }} />}
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
  subNodes,
  brandSlot,
  hideQuantity,
  onDuplicate,
  onRename,
}: {
  brandSlot?: ReactNode | undefined;
  hideQuantity?: boolean | undefined;
  onDuplicate?: ((name: string) => void) | undefined;
  onRename?: ((name: string) => void) | undefined;
  installationSummary?: string;
  hideBrand?: boolean;
  unified?: boolean;
  fieldsOnly?: boolean;
  extraFields?: ReactNode;
  subNodes?: ReactNode;
  def: ItemDef;
  items: Record<string, ItemState>;
  setItem: (key: string, patch: Partial<ItemState>) => void;
  nested?: boolean;
}) {
  const st = items[def.key] ?? {};
  const mediaQuery = useQuery({ queryKey: ["inventory-reference-media"], queryFn: loadInventoryReferenceMedia, staleTime: 30 * 60_000, enabled: !!unified });
  const media = inventoryReferenceFor(def.label, mediaQuery.data);
  const [details, setDetails] = useState(false);
  const on = fieldsOnly || !!st.on;
  if (unified) return (
    <InventoryRow name={def.label} image={media?.url} onOpen={() => setDetails(true)} testId="amenity-inventory-row" group={!!subNodes}
      meta={subNodes ? `Grupo · ${Array.isArray(subNodes) ? subNodes.length : 0} itens` : installationSummary || summary(st, def) || (st.on === undefined ? "Ainda não respondido" : st.on ? "STAYO · Disponível" : "STAYO · Não disponível")}
      actions={<>
        <AnswerBtn kind="no" on={st.on === false} onClick={() => setItem(def.key, { on: false })} />
        <AnswerBtn kind="yes" on={st.on === true} onClick={() => { setItem(def.key, { on: true }); if (extraFields) setDetails(true); }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" className="inline-flex h-11 w-9 shrink-0 rounded-lg p-0 sm:inline-flex" aria-label={`Mais ações para ${def.label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDetails(true)}>Detalhes</DropdownMenuItem>
            {onDuplicate && <DropdownMenuItem onSelect={() => { const name = window.prompt("Nome do novo item (só neste imóvel)", `${def.label} 2`)?.trim(); if (name) onDuplicate(name); }}>Duplicar e renomear</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </>}
    >
      {subNodes && (
        <ul className="col-span-full ml-2 list-none border-l border-border pl-2 sm:ml-7 sm:pl-3">
                    {subNodes}
        </ul>
      )}
      <InventoryDetailLayout open={details} onOpenChange={setDetails} name={def.label} media={media}>
        <InventoryDetailFields values={{ name: def.label, quantity: st.qty == null ? "" : String(st.qty), brand: st.brand ?? "", condition: (st.characteristics?.['inventory_condition'] as InventoryCondition) || null, notes: st.notes ?? "" }} nameReadOnly={!onRename} hideQuantity={hideQuantity} brandSlot={brandSlot} onChange={(patch) => patch.name !== undefined && onRename ? (patch.name.trim() && onRename(patch.name)) : setItem(def.key, {
          ...(patch.quantity !== undefined ? { qty: patch.quantity === "" ? null : Number(patch.quantity) } : {}),
          ...(patch.brand !== undefined ? { brand: patch.brand } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.condition !== undefined ? { characteristics: { ...st.characteristics, inventory_condition: patch.condition ?? "" } } : {}),
        })} extra={extraFields ?? <CharacteristicFields name={def.label} state={st} onChange={(patch) => setItem(def.key, patch)} />} />
      </InventoryDetailLayout>
    </InventoryRow>
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
          <div className="sm:col-span-full"><CharacteristicFields name={def.label} state={st} onChange={(patch) => setItem(def.key, patch)} /></div>
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

function SubBtn({ kind, on, onClick }: { kind: "no" | "yes"; on: boolean; onClick: () => void }) {
  return <AnswerBtn kind={kind} on={on} onClick={onClick} />;
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
    <div className="grid gap-2 rounded-[var(--radius-card)] border bg-white p-3 sm:grid-cols-3" style={{ borderColor: "var(--stayo-border)" }}>
      {fields.map(([k, label, min]) => (
        <div key={k} className="flex items-center justify-between gap-2 sm:flex-col sm:items-center sm:gap-1">
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
