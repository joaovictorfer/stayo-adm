import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BedDouble, Building2, CalendarPlus, ChevronDown, ChevronRight, Eye, EyeOff, MapPin, Megaphone, Pencil, Wifi } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { useAdminCoverUrl } from "../CoverPicker";
import { Collapsible } from "./FichaParts";
import { adminCondominiumQuery, adminCondominiumsListQuery, coreApi } from "../../../lib/api/queries";
import {
  createInspection,
  createTimelineUpdate,
  getPropertyDetails,
  listPortalInspections,
  listPortalTimeline,
  savePropertyDetails,
  type PropertyDetailsInput,
} from "../../../lib/api/owner-portal-data";
import type { ImplementationProject } from "../../../types/core";

const muted = { color: "var(--stayo-ink-muted)" };
const border = { borderColor: "var(--stayo-border)" };
const link = { color: "var(--stayo-forest)" };
const input = "mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm text-[var(--stayo-ink)]";
const linkCls = "text-xs font-medium underline underline-offset-2";

const ACCESS_LABELS: Record<string, string> = { key: "Chave", lock: "Fechadura digital", concierge: "Portaria", other: "Outro" };

type Row = { label: string; value: string | null | undefined; detail?: string | null };

function Block({ icon, title, subtitle, action, children }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border bg-white px-4 py-3 sm:px-5" style={border}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-forest)" }}>{icon}</span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{title}</h3>
            {subtitle && <p className="truncate text-xs" style={muted}>{subtitle}</p>}
          </div>
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
  return (
    <li style={border}>
      <button
        type="button"
        disabled={!expandable && !onEdit}
        aria-expanded={expandable ? open : undefined}
        onClick={() => (expandable ? setOpen((o) => !o) : onEdit?.())}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-left text-sm disabled:cursor-default sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]"
      >
        <span className="font-medium">{row.label}</span>
        <span className="col-start-1 row-start-2 truncate sm:col-start-2 sm:row-start-1" style={muted}>{row.value || "Não informado"}</span>
        <span className="row-span-2 sm:row-span-1" style={muted}>
          {expandable ? <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> : onEdit ? <ChevronRight className="size-4" /> : null}
        </span>
      </button>
      {expandable && open && (
        <div className="mb-2.5 flex flex-col gap-2 rounded-md px-3 py-2 text-sm sm:flex-row sm:items-start sm:justify-between" style={{ backgroundColor: "var(--stayo-bg)" }}>
          <p style={muted}>{row.detail}</p>
          {onEdit && (
            <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1 font-medium underline underline-offset-2">
              <Pencil className="size-3.5" /> Editar
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border bg-white p-4" style={border}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em]" style={muted}>{title}</h3>
      <div className="mt-2.5 space-y-2">{children}</div>
    </section>
  );
}

const num = (v: number | null | undefined) => (v != null ? String(v) : "");
const toNum = (v: string) => (v.trim() === "" ? null : Number(v));

export function FichaImovel({ implementation, onGoOwner, onGoPortal }: { implementation: ImplementationProject; onGoOwner: () => void; onGoPortal: () => void }) {
  const qc = useQueryClient();
  const adminCover = useAdminCoverUrl(implementation.id);
  const [editing, setEditing] = useState(false);

  const detailsQ = useQuery({ queryKey: ["implementation-property-details", implementation.id], queryFn: () => getPropertyDetails(implementation.id) });
  const condoQ = useQuery({ ...adminCondominiumQuery(implementation.condominiumId ?? ""), enabled: Boolean(implementation.condominiumId) });
  const condoListQ = useQuery({ ...adminCondominiumsListQuery(), enabled: editing });
  const timelineQ = useQuery({ queryKey: ["implementation-timeline", implementation.id], queryFn: () => listPortalTimeline(implementation.id) });
  const inspectionsQ = useQuery({ queryKey: ["implementation-inspections", implementation.id], queryFn: () => listPortalInspections(implementation.id) });
  const d = detailsQ.data;

  const [condoId, setCondoId] = useState("");
  const [unit, setUnit] = useState("");
  const [tower, setTower] = useState("");
  const [ptype, setPtype] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [capacity, setCapacity] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [parking, setParking] = useState("");
  const [accessType, setAccessType] = useState<PropertyDetailsInput["accessType"]>(null);
  const [accessNotes, setAccessNotes] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [wifiNetwork, setWifiNetwork] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [timelineTitle, setTimelineTitle] = useState("");
  const [timelineDescription, setTimelineDescription] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => {
    if (!editing) setShowPwd(false);
  }, [editing]);

  function startEdit() {
    setCondoId(implementation.condominiumId ?? "");
    setUnit(implementation.unit ?? "");
    setTower(implementation.tower ?? "");
    setPtype(implementation.propertyType ?? "");
    setBedrooms(num(implementation.bedrooms));
    setCapacity(num(implementation.capacity));
    setBathrooms(num(d?.bathrooms));
    setParking(num(d?.parkingSpots));
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
        bedrooms: d?.bedrooms ?? implementation.bedrooms,
        suites: d?.suites ?? null,
        bathrooms: toNum(bathrooms),
        parkingSpots: toNum(parking),
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

  const publishUpdate = useMutation({
    mutationFn: () => createTimelineUpdate({ implementationId: implementation.id, title: timelineTitle, description: timelineDescription, kind: "update", ownerVisible: true }),
    onSuccess: async () => {
      setTimelineTitle("");
      setTimelineDescription("");
      await qc.invalidateQueries({ queryKey: ["implementation-timeline", implementation.id] });
      toast.success("Atualização publicada no portal");
    },
  });

  const scheduleInspection = useMutation({
    mutationFn: () =>
      createInspection({ implementationId: implementation.id, type: "implantacao", scheduledFor: inspectionDate ? new Date(inspectionDate).toISOString() : null, publicNotes: inspectionNotes, ownerVisible: true }),
    onSuccess: async () => {
      setInspectionDate("");
      setInspectionNotes("");
      await qc.invalidateQueries({ queryKey: ["implementation-inspections", implementation.id] });
      toast.success("Vistoria adicionada ao portal");
    },
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
  const condoAddress = condo ? [condo.address, condo.neighborhood, condo.city, condo.state].filter(Boolean).join(", ") : "";
  const legacyAddress = [implementation.address, implementation.city].filter(Boolean).join(", ");

  const pendencies: Array<{ label: string; cta: string; onClick: () => void }> = [];
  if (!adminCover) pendencies.push({ label: "Fotos do imóvel ainda não adicionadas", cta: "Adicionar fotos", onClick: onGoPortal });
  if (!linked) pendencies.push({ label: "Imóvel sem condomínio vinculado", cta: "Vincular condomínio", onClick: startEdit });
  if (d !== undefined && (!d?.wifiNetwork || !d?.wifiPassword)) pendencies.push({ label: "Dados de Wi-Fi não informados", cta: "Completar Wi-Fi", onClick: startEdit });
  if (d !== undefined && !d?.accessType) pendencies.push({ label: "Forma de acesso não informada", cta: "Definir acesso", onClick: startEdit });

  const sidebar = (
    <>
      <SideCard title="Condomínio">
        {linked ? (
          <>
            <p className="text-sm font-semibold">{condo?.name ?? implementation.condominiumName}</p>
            <p className="text-xs" style={muted}>Cadastro compartilhado · endereço vinculado</p>
            <div className="flex flex-wrap gap-4 pt-1">
              <Link to="/condominios/$id" params={{ id: implementation.condominiumId as string }} className={linkCls} style={link}>Ver condomínio</Link>
              <button type="button" onClick={startEdit} className={linkCls} style={link}>Trocar vínculo</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm" style={muted}>{implementation.condominiumName ? `${implementation.condominiumName} · sem cadastro vinculado` : "Nenhum condomínio vinculado"}</p>
            <button type="button" onClick={startEdit} className={linkCls} style={link}>Vincular condomínio</button>
          </>
        )}
      </SideCard>
      <SideCard title="Proprietário">
        <p className="text-sm font-semibold">{implementation.ownerName || "Não informado"}</p>
        <button type="button" onClick={onGoOwner} className={linkCls} style={link}>Ver proprietário</button>
      </SideCard>
      <SideCard title="Pendências">
        {pendencies.length === 0 ? (
          <p className="text-sm" style={muted}>Nenhuma pendência no imóvel.</p>
        ) : (
          <ul className="space-y-2">
            {pendencies.map((p) => (
              <li key={p.label} className="flex items-center justify-between gap-3 rounded-md px-3 py-2" style={{ backgroundColor: "var(--stayo-warning-soft)" }}>
                <span className="text-sm">{p.label}</span>
                <button type="button" onClick={p.onClick} className={`${linkCls} shrink-0`} style={link}>{p.cta}</button>
              </li>
            ))}
          </ul>
        )}
      </SideCard>
    </>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--stayo-font-display)" }}>Dados do imóvel</h2>
            <p className="text-sm" style={muted}>Informações da unidade e do condomínio.</p>
          </div>
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={startEdit}><Pencil /> Editar dados</Button>
          )}
        </div>


        {editing ? (
          <section className="space-y-4 rounded-[var(--radius-card)] border bg-white p-4 sm:p-5" style={border}>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-xs font-medium" style={muted}>Quartos<input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={input} style={border} /></label>
              <label className="text-xs font-medium" style={muted}>Banheiros<input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className={input} style={border} /></label>
              <label className="text-xs font-medium" style={muted}>Capacidade<input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={input} style={border} /></label>
              <label className="text-xs font-medium" style={muted}>Vagas<input type="number" min={0} value={parking} onChange={(e) => setParking(e.target.value)} className={input} style={border} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>{saving ? "Salvando..." : "Salvar dados"}</Button>
            </div>
          </section>
        ) : (
          <>
            <Block icon={<Building2 className="size-4" />} title="Identificação">
              <ul className="divide-y" style={border}>
                <Line row={{ label: "Condomínio", value: (condo?.name ?? implementation.condominiumName) ? `${condo?.name ?? implementation.condominiumName}${linked ? " · Cadastrado" : ""}` : null }} onEdit={startEdit} />
                <Line row={{ label: "Unidade", value: implementation.unit }} onEdit={startEdit} />
                <Line row={{ label: "Torre / bloco", value: implementation.tower }} onEdit={startEdit} />
                <Line row={{ label: "Tipo", value: implementation.propertyType }} onEdit={startEdit} />
              </ul>
            </Block>

            <Block
              icon={<MapPin className="size-4" />}
              title="Endereço"
              action={linked ? <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-ink-muted)" }}>Herdado do condomínio</span> : undefined}
            >
              <div className="flex flex-col gap-2 rounded-md p-3 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: "var(--stayo-bg)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{linked ? `Endereço do condomínio ${condo?.name ?? implementation.condominiumName ?? ""}` : "Sem condomínio vinculado"}</p>
                  <p className="text-xs" style={muted}>
                    {linked ? condoAddress || "Endereço ainda não preenchido no cadastro do condomínio" : legacyAddress || "Vincule um condomínio cadastrado para reaproveitar o endereço."}
                  </p>
                </div>
                {linked ? (
                  <Link to="/condominios/$id" params={{ id: implementation.condominiumId as string }} className={`${linkCls} shrink-0`} style={link}>Ver endereço</Link>
                ) : (
                  <button type="button" onClick={startEdit} className={`${linkCls} shrink-0`} style={link}>Vincular condomínio</button>
                )}
              </div>
            </Block>

            <Block icon={<BedDouble className="size-4" />} title="Características">
              <ul className="divide-y" style={border}>
                <Line row={{ label: "Quartos", value: num(implementation.bedrooms) }} onEdit={startEdit} />
                <Line row={{ label: "Banheiros", value: num(d?.bathrooms) }} onEdit={startEdit} />
                <Line row={{ label: "Capacidade", value: implementation.capacity != null ? `${implementation.capacity} hóspedes` : null }} onEdit={startEdit} />
                <Line row={{ label: "Vagas", value: num(d?.parkingSpots) }} onEdit={startEdit} />
              </ul>
            </Block>

            <Block icon={<Wifi className="size-4" />} title="Acesso e conectividade" subtitle="Compartilhado com o proprietário">
              <ul className="divide-y" style={border}>
                <Line row={{ label: "Rede Wi-Fi", value: d?.wifiNetwork }} onEdit={startEdit} />
                <li style={border}>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                    <span className="font-medium">Senha Wi-Fi</span>
                    <span className="col-start-1 row-start-2 flex items-center gap-2 truncate sm:col-start-2 sm:row-start-1" style={muted}>
                      {d?.wifiPassword ? (showPwd ? d.wifiPassword : "••••••••••") : "Não informado"}
                      {d?.wifiPassword && (
                        <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Ocultar senha do Wi-Fi" : "Mostrar senha do Wi-Fi"}>
                          {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      )}
                    </span>
                    <button type="button" onClick={startEdit} aria-label="Editar senha do Wi-Fi" className="row-span-2 sm:row-span-1" style={muted}><ChevronRight className="size-4" /></button>
                  </div>
                </li>
                <Line
                  row={{
                    label: "Acesso ao imóvel",
                    value: d?.accessType ? ACCESS_LABELS[d.accessType] : null,
                    detail: [d?.accessNotes, d?.accessCode ? "Senha da fechadura cadastrada (edite para ver)" : null].filter(Boolean).join(" · ") || null,
                  }}
                  onEdit={startEdit}
                />
              </ul>
            </Block>
          </>
        )}

        <div className="flex flex-col gap-4 lg:hidden">{sidebar}</div>

        <Collapsible title="Linha do tempo pública" summary="Atualizações visíveis no Portal do Proprietário">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
            <input value={timelineTitle} onChange={(e) => setTimelineTitle(e.target.value)} placeholder="Título da atualização" className="rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={border} />
            <input value={timelineDescription} onChange={(e) => setTimelineDescription(e.target.value)} placeholder="Mensagem para o proprietário" className="rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={border} />
            <Button size="sm" onClick={() => publishUpdate.mutate()} disabled={!timelineTitle.trim() || publishUpdate.isPending}><Megaphone /> Publicar</Button>
          </div>
          <div className="mt-4 space-y-2">
            {(timelineQ.data ?? []).slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 border-t pt-3 text-sm" style={border}>
                <div>
                  <strong>{event.title}</strong>
                  {event.description && <p className="text-xs" style={muted}>{event.description}</p>}
                </div>
                <span className="shrink-0 text-xs" style={muted}>{new Intl.DateTimeFormat("pt-BR").format(new Date(event.date))}</span>
              </div>
            ))}
          </div>
        </Collapsible>

        <Collapsible title="Vistorias" summary="Agendamento e resumo liberados no portal">
          <div className="grid gap-3 sm:grid-cols-[13rem_1fr_auto]">
            <input type="datetime-local" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} className="rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={border} />
            <input value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder="Resumo para o proprietário" className="rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={border} />
            <Button size="sm" onClick={() => scheduleInspection.mutate()} disabled={!inspectionDate || scheduleInspection.isPending}><CalendarPlus /> Agendar</Button>
          </div>
          <div className="mt-4 space-y-2">
            {(inspectionsQ.data ?? []).map((i) => (
              <div key={i.id} className="flex items-center justify-between border-t pt-3 text-sm" style={border}>
                <span>{i.publicNotes || "Vistoria do imóvel"}</span>
                <strong>{i.status === "completed" ? "Concluída" : "Agendada"}</strong>
              </div>
            ))}
          </div>
        </Collapsible>

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
  );
}
