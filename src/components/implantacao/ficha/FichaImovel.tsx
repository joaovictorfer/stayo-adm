import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Building, Check, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff, FileText, Home, ImageIcon, MapPin, Pencil, RefreshCw, UserRound, Wifi } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { usePropertyPendencies } from "./property-pendencies";
import { Collapsible } from "./FichaParts";
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
  return (
    <li className="border-b last:border-b-0" style={border}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <button type="button" onClick={() => (expandable ? setOpen((o) => !o) : onEdit?.())} className="text-left font-medium" style={navy}>{row.label}</button>
        <button type="button" onClick={() => (expandable ? setOpen((o) => !o) : onEdit?.())} className="col-start-1 row-start-2 flex min-w-0 items-center gap-2 text-left sm:col-start-2 sm:row-start-1" style={muted}>
          <span className="truncate">{row.value || "Não informado"}</span>
        </button>
        <span className="row-span-2 flex items-center gap-3 sm:row-span-1">
          {row.extra}
          <button type="button" onClick={() => (expandable ? setOpen((o) => !o) : onEdit?.())} aria-label={`Editar ${row.label}`} style={navy}>
            {expandable ? <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> : <ChevronRight className="size-4" />}
          </button>
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

export function FichaImovel({ implementation, onGoOwner, onGoPortal }: { implementation: ImplementationProject; onGoOwner: () => void; onGoPortal: () => void }) {
  const qc = useQueryClient();
  const { keys: pendencyKeys, detailsQ } = usePropertyPendencies(implementation.id);
  const [editing, setEditing] = useState(false);

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
        bedrooms: toNum(bedrooms),
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
  if (pendencyKeys.includes("wifi")) pendencies.push({ label: "Dados de Wi-Fi não informados.", cta: "Completar", onClick: startEdit });
  if (pendencyKeys.includes("access")) pendencies.push({ label: "Forma de acesso não informada.", cta: "Definir", onClick: startEdit });

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
            <ActionRow icon={<RefreshCw className="size-4" />} label="Trocar vínculo" onClick={startEdit} />
          </>
        ) : (
          <>
            <p className="py-3 text-sm" style={muted}>{implementation.condominiumName ? `${implementation.condominiumName} · sem cadastro vinculado` : "Nenhum condomínio vinculado"}</p>
            <ActionRow icon={<RefreshCw className="size-4" />} label="Vincular condomínio" onClick={startEdit} />
          </>
        )}
      </Card>
      <Card icon={<UserRound className="size-4" />} title="Proprietário">
        <div className="flex items-center gap-3 py-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ backgroundColor: "var(--ficha-subtle)", ...navy }}>{initials(implementation.ownerName ?? "")}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold" style={display}>{implementation.ownerName || "Não informado"}</p>
            <p className="text-sm" style={muted}>Proprietário(a)</p>
          </div>
        </div>
        <ActionRow icon={<ExternalLink className="size-4" />} label="Ver proprietário" onClick={onGoOwner} />
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
        {!editing && (
          <Button type="button" variant="outline" onClick={startEdit} className="h-11 rounded-lg bg-white px-4" style={navy}>
            <Pencil /> <span className="hidden sm:inline">Editar dados</span><span className="sm:hidden">Editar</span>
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(18rem,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {editing ? (
            <section className="space-y-4 rounded-xl border bg-white p-4 sm:p-5" style={border}>
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
              <Card icon={<FileText className="size-4" />} title="Identificação">
                <ul>
                  <Line row={{ label: "Unidade", value: implementation.unit }} onEdit={startEdit} />
                  <Line row={{ label: "Torre / bloco", value: implementation.tower }} onEdit={startEdit} />
                  <Line row={{ label: "Tipo", value: implementation.propertyType ? implementation.propertyType.charAt(0).toLocaleUpperCase("pt-BR") + implementation.propertyType.slice(1) : implementation.propertyType }} onEdit={startEdit} />
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

              <Card icon={<Home className="size-4" />} title="Características">
                <ul>
                  <Line row={{ label: "Quartos", value: num(implementation.bedrooms) }} onEdit={startEdit} />
                  <Line row={{ label: "Banheiros", value: num(d?.bathrooms) }} onEdit={startEdit} />
                  <Line row={{ label: "Capacidade", value: implementation.capacity != null ? `${implementation.capacity} hóspedes` : null }} onEdit={startEdit} />
                  <Line row={{ label: "Vagas", value: num(d?.parkingSpots) }} onEdit={startEdit} />
                </ul>
              </Card>

              <Card icon={<Wifi className="size-4" />} title="Acesso e conectividade">
                <ul>
                  <Line row={{ label: "Rede Wi-Fi", value: d?.wifiNetwork }} onEdit={startEdit} />
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
                    onEdit={startEdit}
                  />
                  <Line
                    row={{
                      label: "Acesso ao imóvel",
                      value: d?.accessType ? ACCESS_LABELS[d.accessType] : null,
                      detail: [d?.accessNotes, d?.accessCode ? "Senha da fechadura cadastrada (edite para ver)" : null].filter(Boolean).join(" · ") || null,
                    }}
                    onEdit={startEdit}
                  />
                </ul>
              </Card>
            </>
          )}

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
