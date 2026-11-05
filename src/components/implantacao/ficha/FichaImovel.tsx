import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, AlertCircle, Building, Check, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff, FileText, Home, ImageIcon, Loader2, MapPin, Pencil, RefreshCw, Trash2, Upload, UserRound, Wifi } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { usePropertyPendencies } from "./property-pendencies";
import { Collapsible } from "./FichaParts";
import { DivergenceBox } from "./SourceBadge";
import { compositionDivergences, countsFromRooms, divergenceSnapshot, resolveField, type CompositionRoom } from "../../../lib/field-sources";
import { fieldDecisionsQuery, saveFieldDecision } from "../../../lib/api/field-decisions";
import { supabase as sb } from "@/integrations/supabase/client";
import { adminCondominiumQuery, adminCondominiumsListQuery, coreApi } from "../../../lib/api/queries";
import {
  savePropertyDetails,
  type PropertyDetailsInput,
} from "../../../lib/api/owner-portal-data";
import type { ImplementationProject } from "../../../types/core";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  getImplementationPlatforms,
  setImplementationAllowedChannels,
  type DistributionChannel,
} from "../../../lib/api/owner-platforms";
import { formatDateTime } from "../../../lib/format-datetime";
import {
  getAdminCoverState,
  removeImplementationCover,
  uploadImplementationCoverFor,
} from "../../../lib/api/implementation-covers";

const navy = { color: "var(--stayo-navy)" };
const muted = { color: "var(--stayo-ink-muted)" };
const border = { borderColor: "var(--stayo-border)" };
const link = navy;
const display = { fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "-0.01em", color: "var(--stayo-navy)" };
const input = "mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm text-[var(--stayo-ink)]";
const linkCls = "text-sm font-medium underline underline-offset-2";

const ACCESS_LABELS: Record<string, string> = { key: "Chave", lock: "Fechadura digital", concierge: "Portaria", other: "Outro" };

type Row = { label: string; value: ReactNode; detail?: string | null; extra?: ReactNode };

function IconDot({ children, size = "size-9" }: { children: ReactNode; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full`} style={{ backgroundColor: "var(--ficha-icon-bg)", color: "var(--ficha-icon-fg)" }}>
      {children}
    </span>
  );
}

function Card({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white px-4 pb-2 pt-3 sm:px-5" style={border}>
      <div className="flex items-center justify-between gap-2 border-b pb-2.5" style={border}>
        <div className="flex min-w-0 items-center gap-3">
          <IconDot>{icon}</IconDot>
          <h3 className="truncate text-lg font-semibold" style={display}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Line({ row, onEdit }: { row: Row; onEdit?: () => void }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(row.detail);
  const act = () => (expandable ? setOpen((o) => !o) : onEdit?.());
  return (
    <li className="border-b last:border-b-0" style={border}>
      <div
        role="button"
        tabIndex={0}
        onClick={act}
        onKeyDown={(e) => { if (e.key === "Enter") act(); }}
        className="group -mx-2 grid min-h-12 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-[var(--ficha-subtle)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
      >
        <span className="text-xs font-medium uppercase tracking-wide sm:text-sm sm:normal-case sm:tracking-normal" style={muted}>{row.label}</span>
        <span className="col-start-1 row-start-2 flex min-w-0 items-center gap-2 sm:col-start-2 sm:row-start-1">
          <span className="truncate text-[0.95rem] font-semibold" style={row.value ? navy : { color: "var(--ficha-pending-fg)" }}>{row.value || "Não informado"}</span>
        </span>
        <span className="row-span-2 flex items-center gap-3 sm:row-span-1">
          {row.extra}
          <span className="grid size-9 place-items-center rounded-full opacity-60 transition group-hover:bg-white group-hover:opacity-100" style={navy} aria-label={`Editar ${row.label}`}>
            {expandable ? <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> : <Pencil className="size-4" />}
          </span>
        </span>
      </div>
      {expandable && open && (
        <div className="mb-2 flex flex-col gap-2 rounded-md px-3 py-2 text-sm sm:flex-row sm:items-start sm:justify-between" style={{ backgroundColor: "var(--ficha-subtle)" }}>
          <p style={muted}>{row.detail}</p>
          {onEdit && (
            <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1 font-medium underline underline-offset-2" style={navy}>
              <Pencil className="size-3.5" /> Editar
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const n = value === "" ? 0 : Number(value);
  const set = (v: number) => onChange(String(Math.max(0, v)));
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2" style={border}>
      <span className="text-sm font-medium" style={navy}>{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => set(n - 1)} className="grid size-9 place-items-center rounded-full border" style={{ ...border, ...navy }}><Minus className="size-4" /></button>
        <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} className="w-10 bg-transparent text-center text-base font-semibold tabular-nums" style={navy} aria-label={label} />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => set(n + 1)} className="grid size-9 place-items-center rounded-full border" style={{ ...border, ...navy }}><Plus className="size-4" /></button>
      </span>
    </div>
  );
}

type EditGroup = "all" | "ident" | "carac" | "acesso";
const GROUP_TITLE: Record<EditGroup, string> = { all: "Dados do imóvel", ident: "Identificação", carac: "Características", acesso: "Acesso e conectividade" };

function ActionRow({ icon, label, onClick, to }: { icon: ReactNode; label: string; onClick?: () => void; to?: { id: string } }) {
  const content = (
    <>
      <span className="flex items-center gap-3"><span style={navy}>{icon}</span><span className={linkCls} style={navy}>{label}</span></span>
      <ChevronRight className="size-4" style={navy} />
    </>
  );
  const cls = "flex w-full items-center justify-between border-t py-3 text-left";
  return to ? (
    <Link to="/condominios/$id" params={to} className={cls} style={border}>{content}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={border}>{content}</button>
  );
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

const num = (v: number | null | undefined) => (v != null ? String(v) : "");
const toNum = (v: string) => (v.trim() === "" ? null : Number(v));

/** Foto de capa do imóvel: upload ou arrastar, em destaque no topo da aba. */
function PropertyCoverCard({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const key = ["implementation-cover", implementationId];
  const coverQ = useQuery({ queryKey: key, queryFn: () => getAdminCoverState(implementationId) });

  const run = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success("Foto da ficha atualizada.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto."),
  });

  function pick(file: File | undefined | null) {
    if (file && !run.isPending) run.mutate(() => uploadImplementationCoverFor(implementationId, file));
  }

  const url = coverQ.data?.implementationUrl ?? null;

  return (
    <section className="rounded-xl border bg-white p-4 sm:px-5" style={border}>
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconDot><ImageIcon className="size-4" /></IconDot>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold" style={display}>Foto do imóvel</h3>
            <p className="text-xs" style={muted}>Usada na ficha e no portal do proprietário.</p>
          </div>
        </div>
        {run.isPending && <Loader2 className="size-4 animate-spin" style={muted} aria-label="Enviando foto" />}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Enviar foto do imóvel"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={run.isPending}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className="relative block h-44 w-full overflow-hidden rounded-lg border-2 border-dashed text-left transition-colors sm:h-52"
        style={{
          borderColor: dragOver ? "var(--stayo-navy)" : "var(--stayo-border)",
          backgroundColor: dragOver ? "var(--ficha-subtle)" : "var(--stayo-bg)",
        }}
        aria-label={url ? "Trocar foto do imóvel" : "Adicionar foto do imóvel"}
      >
        {coverQ.isPending ? (
          <span className="absolute inset-0 animate-pulse bg-[var(--stayo-bg)]" />
        ) : url ? (
          <>
            <img src={url} alt="Foto do imóvel" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute bottom-2 right-2 rounded-full bg-[rgba(11,49,80,0.75)] px-3 py-1.5 text-xs font-medium text-[var(--stayo-surface)]">
              Toque ou arraste para trocar
            </span>
          </>
        ) : (
          <span className="absolute inset-0 grid place-items-center p-4">
            <span className="flex flex-col items-center gap-2 text-center">
              <Upload className="size-6" style={navy} />
              <span className="text-sm font-medium" style={navy}>Toque para enviar ou arraste a foto aqui</span>
              <span className="text-xs" style={muted}>JPG, PNG ou WebP</span>
            </span>
          </span>
        )}
      </button>

      {url && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={run.isPending}
            onClick={() => run.mutate(() => removeImplementationCover(implementationId))}
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--stayo-danger)" }}
          >
            <Trash2 className="size-3.5" /> Remover foto
          </button>
        </div>
      )}
    </section>
  );
}

export function FichaImovel({ implementation, onGoOwner, onGoPortal }: { implementation: ImplementationProject; onGoOwner: () => void; onGoPortal: () => void }) {
  const qc = useQueryClient();
  const { keys: pendencyKeys, detailsQ } = usePropertyPendencies(implementation.id);
  const [editing, setEditing] = useState(false);
  const [group, setGroup] = useState<EditGroup>("all");
  const [showOptional, setShowOptional] = useState(false);

  const condoQ = useQuery({ ...adminCondominiumQuery(implementation.condominiumId ?? ""), enabled: Boolean(implementation.condominiumId) });
  const condoListQ = useQuery({ ...adminCondominiumsListQuery(), enabled: editing });
  const d = detailsQ.data;

  const [condoId, setCondoId] = useState("");
  const [unit, setUnit] = useState("");
  const [tower, setTower] = useState("");
  const [ptype, setPtype] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [capacity, setCapacity] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [parking, setParking] = useState("");
  const [lavatories, setLavatories] = useState("");
  const [parkingBox, setParkingBox] = useState("");
  const roomsQ = useQuery({ queryKey: ["amenities-rooms", implementation.id], queryFn: async () => {
    const { data, error } = await sb.from("implementation_amenities").select("data").eq("implementation_id", implementation.id).maybeSingle();
    if (error) throw error;
    return ((data?.data as { rooms?: CompositionRoom[] } | null)?.rooms ?? []) as CompositionRoom[];
  } });
  const decisionsQ = useQuery(fieldDecisionsQuery(implementation.id));
  const [decBusy, setDecBusy] = useState(false);
  const [accessType, setAccessType] = useState<PropertyDetailsInput["accessType"]>(null);
  const [accessNotes, setAccessNotes] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [wifiNetwork, setWifiNetwork] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [notesDraft, setNotesDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => {
    if (!editing) setShowPwd(false);
  }, [editing]);

  function startEdit(g: EditGroup = "all") {
    setGroup(g);
    setShowOptional(false);
    setCondoId(implementation.condominiumId ?? "");
    setUnit(implementation.unit ?? "");
    setTower(implementation.tower ?? "");
    setPtype(implementation.propertyType ?? "");
    setBedrooms(num(implementation.bedrooms));
    setCapacity(num(implementation.capacity));
    setBathrooms(num(d?.bathrooms));
    setParking(num(d?.parkingSpots));
    setLavatories(num(d?.lavatories));
    setParkingBox(d?.parkingBox ?? "");
    setAccessType(d?.accessType ?? null);
    setAccessNotes(d?.accessNotes ?? "");
    setAccessCode(d?.accessCode ?? "");
    setWifiNetwork(d?.wifiNetwork ?? "");
    setWifiPassword(d?.wifiPassword ?? "");
    setEditing(true);
  }

  const onError = (error: unknown) => toast.error("Não foi possível salvar", { description: error instanceof Error ? error.message : "Seus dados continuam no formulário." });

  const updateImplementation = useMutation({
    mutationFn: (patch: Partial<Pick<ImplementationProject, "condominiumId" | "condominiumName" | "tower" | "unit" | "propertyType" | "bedrooms" | "capacity" | "notes">>) =>
      coreApi.implementations.update(implementation.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["implementations"] }),
    onError,
  });

  const saveDetails = useMutation({
    mutationFn: () =>
      savePropertyDetails(implementation.id, {
        postalCode: d?.postalCode ?? implementation.postalCode,
        street: d?.street ?? implementation.address,
        number: d?.number ?? null,
        complement: d?.complement ?? null,
        district: d?.district ?? null,
        city: d?.city ?? implementation.city,
        state: d?.state ?? null,
        propertyType: d?.propertyType ?? implementation.propertyType,
        bedrooms: toNum(bedrooms),
        suites: d?.suites ?? null,
        bathrooms: toNum(bathrooms),
        parkingSpots: toNum(parking),
        lavatories: toNum(lavatories),
        parkingBox: parkingBox.trim() || null,
        accessType,
        accessNotes: accessNotes || null,
        accessCode: accessCode || null,
        wifiNetwork: wifiNetwork || null,
        wifiPassword: wifiPassword || null,
        notes: d?.notes ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["implementation-property-details", implementation.id] }),
    onError,
  });

  async function handleSave() {
    const selected = condoListQ.data?.find((c) => c.id === condoId);
    try {
      await Promise.all([
        updateImplementation.mutateAsync({
          condominiumId: condoId || null,
          condominiumName: condoId ? (selected?.name ?? implementation.condominiumName) : implementation.condominiumName,
          tower: tower || null,
          unit: unit || null,
          propertyType: ptype || null,
          bedrooms: toNum(bedrooms),
          capacity: toNum(capacity),
        }),
        saveDetails.mutateAsync(),
      ]);
      toast.success("Dados do imóvel atualizados");
      setEditing(false);
    } catch {
      /* já notificado */
    }
  }

  const saving = updateImplementation.isPending || saveDetails.isPending;
  const linked = Boolean(implementation.condominiumId);
  const condo = linked ? condoQ.data : null;
  const condoName = condo?.name ?? implementation.condominiumName;
  const condoAddress = condo ? [condo.address, condo.neighborhood, condo.city, condo.state].filter(Boolean).join(", ") : "";
  const legacyAddress = [implementation.address, implementation.city].filter(Boolean).join(", ");

  const pendencies: Array<{ label: string; cta: string; onClick: () => void }> = [];
  if (pendencyKeys.includes("cover")) pendencies.push({ label: "Fotos do imóvel ainda não adicionadas.", cta: "Adicionar fotos", onClick: onGoPortal });
  if (pendencyKeys.includes("wifi")) pendencies.push({ label: "Dados de Wi-Fi não informados.", cta: "Completar", onClick: () => startEdit("acesso") });
  if (pendencyKeys.includes("access")) pendencies.push({ label: "Forma de acesso não informada.", cta: "Definir", onClick: () => startEdit("acesso") });

  const sidebar = (
    <>
      <Card icon={<FileText className="size-4" />} title="Condomínio">
        {linked ? (
          <>
            <div className="flex items-center gap-3 border-b py-3" style={border}>
              <IconDot size="size-11"><Building className="size-5" /></IconDot>
              <div className="min-w-0">
                <p className="truncate font-semibold" style={display}>{condoName}</p>
                <p className="text-sm" style={muted}>Cadastro compartilhado</p>
              </div>
            </div>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 py-3 text-sm">
              <dt className="font-medium" style={navy}>Endereço</dt><dd style={muted}>Vinculado</dd>
              <dt className="font-medium" style={navy}>Unidades</dt><dd style={muted}>Cadastro reutilizável</dd>
            </dl>
            <ActionRow icon={<ExternalLink className="size-4" />} label="Ver condomínio" to={{ id: implementation.condominiumId as string }} />
            <ActionRow icon={<RefreshCw className="size-4" />} label="Trocar vínculo" onClick={() => startEdit("ident")} />
          </>
        ) : (
          <>
            <p className="py-3 text-sm" style={muted}>{implementation.condominiumName ? `${implementation.condominiumName} · sem cadastro vinculado` : "Nenhum condomínio vinculado"}</p>
            <ActionRow icon={<RefreshCw className="size-4" />} label="Vincular condomínio" onClick={() => startEdit("ident")} />
          </>
        )}
      </Card>
      <PlatformsCard implementationId={implementation.id} />
      <section className="rounded-xl border bg-white p-4 sm:px-5" style={border}>
        <div className="flex items-center gap-3 pb-3">
          <AlertCircle className="size-6 shrink-0" style={{ color: "var(--ficha-pending-fg)" }} />
          <h3 className="text-lg font-semibold" style={display}>Pendências</h3>
        </div>
        {pendencies.length === 0 ? (
          <p className="text-sm" style={muted}>Nenhuma pendência no imóvel.</p>
        ) : (
          <ul className="space-y-2">
            {pendencies.map((p) => (
              <li key={p.label}>
                <button type="button" onClick={p.onClick} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 text-left" style={{ backgroundColor: "var(--ficha-pending-bg)" }}>
                  <ImageIcon className="size-5" style={{ color: "var(--stayo-danger)" }} />
                  <span className="text-sm" style={navy}>{p.label}</span>
                  <span className="flex items-center gap-1"><span className={linkCls} style={navy}>{p.cta}</span><ChevronRight className="size-4" style={navy} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold sm:text-3xl" style={display}>Dados do imóvel</h2>
          <p className="hidden text-sm sm:block sm:text-base" style={muted}>Informações da unidade e do condomínio.</p>
        </div>
        {(
          <Button type="button" variant="outline" onClick={() => startEdit()} className="h-11 rounded-lg bg-white px-4" style={navy}>
            <Pencil /> <span className="hidden sm:inline">Editar dados</span><span className="sm:hidden">Editar</span>
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(18rem,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
              <PropertyCoverCard implementationId={implementation.id} />
              <Card icon={<FileText className="size-4" />} title="Identificação">
                <ul>
                  <Line row={{ label: "Unidade", value: implementation.unit }} onEdit={() => startEdit("ident")} />
                  <Line row={{ label: "Torre / bloco", value: implementation.tower }} onEdit={() => startEdit("ident")} />
                  <Line row={{ label: "Tipo", value: implementation.propertyType ? implementation.propertyType.charAt(0).toLocaleUpperCase("pt-BR") + implementation.propertyType.slice(1) : implementation.propertyType }} onEdit={() => startEdit("ident")} />
                </ul>
              </Card>

              <Card
                icon={<MapPin className="size-4" />}
                title="Endereço"
                action={linked ? <span className="rounded-md px-2 py-1 text-xs" style={{ backgroundColor: "var(--ficha-subtle)", ...muted }}>Herdado do condomínio</span> : undefined}
              >
                <div className="my-3 grid gap-3 rounded-lg border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" style={{ ...border, backgroundColor: "var(--ficha-subtle)" }}>
                  <span className="grid size-11 place-items-center rounded-full bg-white" style={navy}><Building className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="font-semibold" style={navy}>{linked ? `Endereço do condomínio ${condoName ?? ""}` : "Endereço da unidade"}</p>
                    <p className="text-sm" style={muted}>
                      {linked ? condoAddress || "Este endereço é reutilizado pelas unidades vinculadas." : legacyAddress || "Não informado"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 sm:items-end">
                    {linked ? (
                      <>
                        <span className="text-sm" style={navy}>Endereço vinculado ao condomínio</span>
                        <Link to="/condominios/$id" params={{ id: implementation.condominiumId as string }} className="flex items-center gap-1.5 text-sm underline underline-offset-2" style={navy}>
                          Ver endereço <ExternalLink className="size-4" />
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card icon={<Home className="size-4" />} title="Composição">
                <ul>
                  <Line row={{ label: "Quartos", value: num(implementation.bedrooms) }} onEdit={() => startEdit("carac")} />
                  <Line row={{ label: "Suítes", value: num(d?.suites), detail: "Calculado pelos quartos marcados como suíte" }} />
                  <Line row={{ label: "Banheiros", value: num(d?.bathrooms) }} onEdit={() => startEdit("carac")} />
                  <Line row={{ label: "Lavabos", value: num(d?.lavatories) }} onEdit={() => startEdit("carac")} />
                  <Line row={{ label: "Capacidade", value: implementation.capacity != null ? `${implementation.capacity} hóspedes` : null }} onEdit={() => startEdit("carac")} />
                </ul>
                {(() => {
                  const divs = compositionDivergences({ bedrooms: implementation.bedrooms ?? null, bathrooms: d?.bathrooms ?? null, lavatories: d?.lavatories ?? null }, countsFromRooms(roomsQ.data));
                  const decisions = decisionsQ.data ?? {};
                  const visible = divs.map((x) => ({ x, f: resolveField(String(x.registered), String(x.collected), "digits", decisions[`imovel:${x.key}`]) })).filter((v) => v.f.divergence);
                  if (!visible.length) return null;
                  const decide = async (key: string, decision: "usar_oficial" | "conferir_local", snap: string) => {
                    setDecBusy(true);
                    try { await saveFieldDecision(implementation.id, `imovel:${key}`, decision, snap); await qc.invalidateQueries({ queryKey: ["field-decisions", implementation.id] }); }
                    catch { toast.error("Não foi possível registrar."); } finally { setDecBusy(false); }
                  };
                  return <div className="mb-3 grid gap-2">{visible.map(({ x, f }) => <DivergenceBox key={x.key} label={x.label} officialLabel="Cadastro" submittedLabel="Coleta" checkLabel="Conferir na vistoria" busy={decBusy}
                    official={x.registered} submitted={x.collected} checking={f.divergence!.checking}
                    onOfficial={() => void decide(x.key, "usar_oficial", divergenceSnapshot(String(x.registered), String(x.collected)))}
                    onCheck={() => void decide(x.key, "conferir_local", divergenceSnapshot(String(x.registered), String(x.collected)))}
                    onSubmitted={async () => {
                      setDecBusy(true);
                      try {
                        if (x.key === "bedrooms") await updateImplementation.mutateAsync({ bedrooms: x.collected });
                        else {
                          await savePropertyDetails(implementation.id, {
                            postalCode: d?.postalCode ?? null, street: d?.street ?? null, number: d?.number ?? null, complement: d?.complement ?? null, district: d?.district ?? null, city: d?.city ?? null, state: d?.state ?? null,
                            propertyType: d?.propertyType ?? null, bedrooms: implementation.bedrooms ?? null, suites: d?.suites ?? null,
                            bathrooms: x.key === "bathrooms" ? x.collected : d?.bathrooms ?? null, lavatories: x.key === "lavatories" ? x.collected : d?.lavatories ?? null,
                            parkingSpots: d?.parkingSpots ?? null, accessType: d?.accessType ?? null, accessNotes: d?.accessNotes ?? null, accessCode: d?.accessCode ?? null,
                            wifiNetwork: d?.wifiNetwork ?? null, wifiPassword: d?.wifiPassword ?? null, notes: d?.notes ?? null,
                          });
                        }
                        await qc.invalidateQueries({ queryKey: ["implementation-property-details", implementation.id] });
                        toast.success(`${x.label}: valor da coleta aceito`);
                      } catch { toast.error("Não foi possível salvar."); } finally { setDecBusy(false); }
                    }} />)}</div>;
                })()}
              </Card>

              <Card icon={<Home className="size-4" />} title="Estacionamento">
                <ul>
                  <Line row={{ label: "Vagas", value: num(d?.parkingSpots) }} onEdit={() => startEdit("carac")} />
                  <Line row={{ label: "Box", value: d?.parkingBox }} onEdit={() => startEdit("carac")} />
                </ul>
              </Card>

              <Card icon={<Wifi className="size-4" />} title="Acesso e conectividade">
                <ul>
                  <Line row={{ label: "Rede Wi-Fi", value: d?.wifiNetwork }} onEdit={() => startEdit("acesso")} />
                  <Line
                    row={{
                      label: "Senha Wi-Fi",
                      value: d?.wifiPassword ? (
                        <span className="flex items-center gap-3">
                          <span className={showPwd ? "" : "tracking-[0.2em]"}>{showPwd ? d.wifiPassword : "••••••••••"}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setShowPwd((v) => !v); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setShowPwd((v) => !v); } }}
                            aria-label={showPwd ? "Ocultar senha do Wi-Fi" : "Mostrar senha do Wi-Fi"}
                            style={navy}
                          >
                            {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </span>
                        </span>
                      ) : null,
                    }}
                    onEdit={() => startEdit("acesso")}
                  />
                  <Line
                    row={{
                      label: "Acesso ao imóvel",
                      value: d?.accessType ? ACCESS_LABELS[d.accessType] : null,
                      detail: [d?.accessNotes, d?.accessCode ? "Senha da fechadura cadastrada (edite para ver)" : null].filter(Boolean).join(" · ") || null,
                    }}
                    onEdit={() => startEdit("acesso")}
                  />
                </ul>
              </Card>

          <div className="flex flex-col gap-4 lg:hidden">{sidebar}</div>

          <Collapsible title="Observações internas" summary="Notas de uso exclusivo da operação">
            {editingNotes ? (
              <div className="space-y-3">
                <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={5} className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={border} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancelar</Button>
                  <Button type="button" size="sm" disabled={updateImplementation.isPending} onClick={() => updateImplementation.mutate({ notes: notesDraft }, { onSuccess: () => { setEditingNotes(false); toast.success("Observação salva"); } })}>Salvar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="whitespace-pre-wrap text-sm" style={implementation.notes ? undefined : muted}>{implementation.notes || "Nenhuma observação interna cadastrada."}</p>
                <button type="button" onClick={() => { setNotesDraft(implementation.notes ?? ""); setEditingNotes(true); }} className={linkCls} style={link}>Editar observação</button>
              </div>
            )}
          </Collapsible>
        </div>

        <aside className="hidden flex-col gap-4 lg:flex">{sidebar}</aside>
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
            <DialogTitle>{GROUP_TITLE[group]}</DialogTitle>
            <DialogDescription>Preencha só o que souber; o resto pode ficar para depois.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              {(group === "all" || group === "ident") && (
                <div className="space-y-3">
                  {group === "all" && <h4 className="text-sm font-semibold" style={display}>Identificação</h4>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium" style={muted}>
                  Condomínio cadastrado
                  <select value={condoId} onChange={(e) => setCondoId(e.target.value)} className={input} style={border}>
                    <option value="">Nenhum condomínio vinculado</option>
                    {(condoListQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium" style={muted}>Unidade<input value={unit} onChange={(e) => setUnit(e.target.value)} className={input} style={border} /></label>
                <label className="text-xs font-medium" style={muted}>Torre / bloco<input value={tower} onChange={(e) => setTower(e.target.value)} className={input} style={border} /></label>
                <label className="text-xs font-medium" style={muted}>Tipo<input value={ptype} onChange={(e) => setPtype(e.target.value)} placeholder="Apartamento, casa..." className={input} style={border} /></label>
              </div>
              <p className="text-xs" style={muted}>O endereço vem do cadastro do condomínio; altere-o na ficha do condomínio.</p>
                </div>
              )}
              {(group === "all" || group === "carac") && (
                <div className="space-y-3">
                  {group === "all" && <h4 className="text-sm font-semibold" style={display}>Características</h4>}
              <div className="grid gap-2 sm:grid-cols-2">
                <Stepper label="Quartos" value={bedrooms} onChange={setBedrooms} />
                <Stepper label="Banheiros" value={bathrooms} onChange={setBathrooms} />
                <Stepper label="Hóspedes" value={capacity} onChange={setCapacity} />
                <Stepper label="Lavabos" value={lavatories} onChange={setLavatories} />
                <Stepper label="Vagas" value={parking} onChange={setParking} />
                <label className="text-xs font-medium" style={muted}>Box<input value={parkingBox} onChange={(e) => setParkingBox(e.target.value)} placeholder="Ex.: 12" className={input} style={border} /></label>
              </div>
                </div>
              )}
              {group === "all" && (
                <button
                  type="button"
                  onClick={() => setShowOptional((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--ficha-subtle)]"
                  style={{ ...border, ...navy }}
                  aria-expanded={showOptional}
                >
                  Detalhes opcionais (acesso, Wi-Fi)
                  <ChevronDown className={`size-4 transition ${showOptional ? "rotate-180" : ""}`} />
                </button>
              )}
              {((group === "all" && showOptional) || group === "acesso") && (
                <div className="space-y-3">
                  {group === "all" && <h4 className="text-sm font-semibold" style={display}>Acesso e conectividade</h4>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium" style={muted}>
                  Acesso ao imóvel
                  <select value={accessType ?? ""} onChange={(e) => setAccessType((e.target.value || null) as PropertyDetailsInput["accessType"])} className={input} style={border}>
                    <option value="">Selecione</option>
                    <option value="key">Chave</option>
                    <option value="lock">Fechadura digital</option>
                    <option value="concierge">Portaria</option>
                    <option value="other">Outro</option>
                  </select>
                </label>
                <label className="text-xs font-medium" style={muted}>Orientações<input value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} className={input} style={border} /></label>
                <label className="text-xs font-medium" style={muted}>Senha da fechadura<input type="password" autoComplete="new-password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className={input} style={border} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium" style={muted}>Rede Wi-Fi<input value={wifiNetwork} autoComplete="off" onChange={(e) => setWifiNetwork(e.target.value)} className={input} style={border} /></label>
                <label className="text-xs font-medium" style={muted}>
                  Senha do Wi-Fi
                  <span className="relative mt-1 block">
                    <input type={showPwd ? "text" : "password"} value={wifiPassword} autoComplete="new-password" onChange={(e) => setWifiPassword(e.target.value)} className="w-full rounded-[var(--radius-control)] border py-2 pl-3 pr-11 text-sm" style={border} />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 grid w-10 place-items-center" style={muted}>
                      {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </span>
                </label>
              </div>
                </div>
              )}
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlatformsCard({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["implementation-platforms", implementationId],
    queryFn: () => getImplementationPlatforms(implementationId),
  });
  const saved = q.data?.allowed_channels ?? null;
  const [draft, setDraft] = useState<DistributionChannel[] | null>(null);
  const allowed = draft ?? saved;
  const channels = q.data?.distribution_channels ?? null;

  const signature = (value: DistributionChannel[] | null) => (value === null ? "*" : [...value].sort().join("|"));
  const dirty = signature(allowed) !== signature(saved);

  const save = useMutation({
    mutationFn: (next: DistributionChannel[] | null) => setImplementationAllowedChannels(implementationId, next),
    onSuccess: (_result, next) => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["implementation-platforms", implementationId] });
      queryClient.invalidateQueries({ queryKey: ["implementations"] });
      toast.success(next === null ? "Todas as plataformas liberadas" : `Liberado: ${next.map((c) => CHANNEL_LABELS[c]).join(" · ")}`);
    },
    onError: (error) =>
      toast.error("Não foi possível salvar as plataformas", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      }),
  });

  const toggle = (key: DistributionChannel) => {
    if (key === "airbnb" || save.isPending) return;
    const current = allowed ?? ALL_CHANNELS;
    setDraft(current.includes(key) ? current.filter((c) => c !== key) : [...current, key]);
  };

  return (
    <section className="rounded-xl border bg-white p-4 sm:px-5" style={border}>
      <h3 className="pb-1 text-lg font-semibold" style={display}>Plataformas</h3>
      <p className="pb-3 text-xs" style={muted}>
        Escolha onde este imóvel pode ser anunciado. O que ficar desmarcado aparece desativado para o proprietário.
      </p>
      {q.isPending ? (
        <p className="text-sm" style={muted}>Carregando…</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ALL_CHANNELS.map((key) => {
            const on = allowed === null ? true : allowed.includes(key);
            const locked = key === "airbnb";
            return (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-disabled={locked || save.isPending || undefined}
                onClick={() => toggle(key)}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-[var(--stayo-navy)]"
                style={{ ...border, color: "var(--stayo-navy)" }}
              >
                <span
                  className="grid size-5 shrink-0 place-items-center rounded border"
                  style={on ? { borderColor: "var(--stayo-navy)", backgroundColor: "var(--stayo-navy)", color: "var(--stayo-surface)" } : border}
                >
                  {on && <Check className="size-3.5" aria-hidden="true" />}
                </span>
                <span className="flex-1 font-medium">{CHANNEL_LABELS[key]}</span>
                {locked && <span className="text-[11px]" style={muted}>Padrão</span>}
              </button>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate(["airbnb"])}>
              Somente Airbnb
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate(null)}>
              Todas
            </Button>
            <Button type="button" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(allowed)}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>

          <div className="mt-2 space-y-1 border-t pt-2 text-sm" style={border}>
            <p className="text-xs" style={muted}>Escolha do proprietário</p>
            <p style={navy}>{channels ? channels.map((c) => CHANNEL_LABELS[c] ?? c).join(" · ") : "Ainda não escolhida."}</p>
            <p className="break-all" style={muted}>Conta Airbnb: {q.data?.airbnb_account_email || "Não informada"}</p>
            {q.data?.distribution_updated_at && (
              <p className="text-xs" style={muted}>
                {q.data.distribution_updated_by === "owner" ? "Informado pelo proprietário" : "Atualizado"} · {formatDateTime(q.data.distribution_updated_at)}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
