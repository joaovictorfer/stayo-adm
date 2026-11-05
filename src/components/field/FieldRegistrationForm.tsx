import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BedDouble,
  Bath,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  Loader2,
  Phone,
  Toilet,
  UserRound,
} from "lucide-react";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { toggleSuite } from "@/lib/amenities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurveyExperience } from "./SurveyExperience";
import { BedSelectionCard, CompactCounter } from "./FieldTouchControls";
import {
  resolveFieldRegistration,
  saveFieldRegistration,
  prepareFieldInventory,
} from "@/lib/field-registration.functions";
import {
  bedTypes,
  contactReady,
  type FieldPatch,
  type FieldRegistration,
  type FieldValues,
} from "@/lib/field-registration";
import { cn } from "@/lib/utils";

/** Empreendimentos já atendidos pela STAYO; o campo continua aceitando um nome novo. */
const KNOWN_CONDOMINIUMS = ["Vêneto", "Ravena", "Delle Alpi", "Le Monde", "Mondeville", "Zagonel", "Winkel Haus"];
const steps = [
  { title: "Proprietário", icon: UserRound },
  { title: "Imóvel", icon: Building2 },
  { title: "Quartos e camas", icon: BedDouble },
  { title: "Vistoria", icon: ClipboardCheck },
];
export function FieldRegistrationForm({ token }: { token: string }) {
  const resolve = useServerFn(resolveFieldRegistration),
    save = useServerFn(saveFieldRegistration),
    prepare = useServerFn(prepareFieldInventory);
  const [record, setRecord] = useState<FieldRegistration | null>(null),
    [values, setValues] = useState<FieldValues | null>(null);
  const [step, setStep] = useState(0),
    [selectedRoom, setSelectedRoom] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [reveal, setReveal] = useState(false),
    [inventoryReady, setInventoryReady] = useState(false);
  const current = useRef<FieldRegistration | null>(null),
    local = useRef<FieldValues | null>(null),
    pending = useRef<FieldPatch>({}),
    running = useRef<Promise<boolean> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    stepRef = useRef(0),
    navigating = useRef(false);
  useEffect(() => {
    let active = true;
    resolve({ data: { token } })
      .then((r) => {
        if (!active) return;
        current.current = r;
        local.current = r.values;
        setRecord(r);
        setValues(r.values);
        const resume = Math.min(r.step, 2);
        setStep(resume);
        stepRef.current = resume;
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Não foi possível abrir o cadastro."),
      );
    return () => {
      active = false;
    };
  }, [token, resolve]);
  async function flush(): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    if (running.current) {
      const ok = await running.current;
      return ok ? flush() : false;
    }
    const r = current.current,
      v = local.current;
    if (!r || !v) return false;
    if (!contactReady(v.name, v.phone)) {
      setError("Preencha nome e telefone válidos.");
      return false;
    }
    if (!Object.keys(pending.current).length) return true;
    const patch = { ...pending.current };
    pending.current = {};
    if (!r.implementationId || (!r.contactLocked && !r.values.name)) {
      patch.name = v.name;
      patch.phone = v.phone;
    }
    setBusy(true);
    setError("");
    const task = (async () => {
      try {
        const next = await save({
          data: { token, revision: r.revision, step: stepRef.current, patch },
        });
        current.current = next;
        setRecord(next);
        const merged = {
          ...next.values,
          ...local.current,
          rooms:
            pending.current.beds || pending.current.suites
              ? (local.current?.rooms ?? next.values.rooms)
              : next.values.rooms,
        };
        local.current = merged;
        setValues(merged);
        setDirty(Object.keys(pending.current).length > 0);
        return true;
      } catch (e) {
        pending.current = { ...patch, ...pending.current };
        setError(e instanceof Error ? e.message : "Não foi possível salvar.");
        return false;
      } finally {
        setBusy(false);
        running.current = null;
      }
    })();
    running.current = task;
    return task;
  }
  function change(patch: FieldPatch) {
    if (!local.current) return;
    const { beds, suites, ...fields } = patch;
    let next: FieldValues = { ...local.current };
    for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
      const value = fields[key];
      if (value !== undefined) Object.assign(next, { [key]: value });
    }
    if (suites)
      next = {
        ...next,
        rooms: next.rooms.map((r) => {
          const edit = suites.find((s) => s.roomId === r.id);
          return edit && r.kind === "quarto" ? toggleSuite(r, edit.suite) : r;
        }),
      };
    if (beds)
      next = {
        ...next,
        rooms: next.rooms.map((r) => {
          const edit = beds.find((b) => b.roomId === r.id);
          return edit
            ? {
                ...r,
                items: {
                  ...r.items,
                  camas: {
                    ...r.items["camas"],
                    on: Object.values(edit.options).some((n) => (n ?? 0) > 0),
                    opts: edit.options as Record<string, number>,
                  },
                },
              }
            : r;
        }),
      };
    local.current = next;
    setValues(next);
    pending.current = {
      ...pending.current,
      ...patch,
      ...(beds
        ? {
            beds: [
              ...(pending.current.beds ?? []).filter(
                (b) => !beds.some((edit) => edit.roomId === b.roomId),
              ),
              ...beds,
            ],
          }
        : {}),
      ...(suites
        ? {
            suites: [
              ...(pending.current.suites ?? []).filter(
                (s) => !suites.some((edit) => edit.roomId === s.roomId),
              ),
              ...suites,
            ],
          }
        : {}),
    };
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (local.current && contactReady(local.current.name, local.current.phone)) void flush();
    }, 700);
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length || running.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function go(next: number) {
    if (!values || navigating.current) return;
    navigating.current = true;
    try {
      if (
        next > 1 &&
        (!values.condominium.trim() ||
          !values.unit.trim() ||
          values.bedrooms === null ||
          values.bathrooms === null ||
          values.lavatories === null)
      ) {
        setError("Informe empreendimento, unidade e as quantidades de ambientes.");
        return;
      }
      if (!(await flush())) return;
      if (next === 2 && !current.current?.values.rooms.length) {
        pending.current = {
          bedrooms: values.bedrooms,
          bathrooms: values.bathrooms,
          lavatories: values.lavatories,
        };
        if (!(await flush())) return;
      }
      if (next === 3) {
        setBusy(true);
        try {
          const r = current.current;
          if (!r) return;
          const saved = await prepare({ data: { token, revision: r.revision } });
          current.current = saved;
          setRecord(saved);
          setInventoryReady(true);
        } catch {
          setError("Não foi possível preparar a vistoria. Tente novamente.");
          return;
        } finally {
          setBusy(false);
        }
      }
      const r = current.current;
      if (r && next !== 3) {
        setBusy(true);
        try {
          const saved = await save({
            data: { token, revision: r.revision, step: next, patch: {} },
          });
          current.current = saved;
          setRecord(saved);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Não foi possível avançar. Tente novamente.");
          return;
        } finally {
          setBusy(false);
        }
      }
      setStep(next);
      stepRef.current = next;
      window.scrollTo({ top: 0, behavior: "instant" });
    } finally {
      navigating.current = false;
    }
  }
  if (!record || !values)
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="space-y-4 text-center">
          <StayoLogo className="mx-auto h-12" />
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <Loader2 className="mx-auto size-6 animate-spin text-primary" />
          )}
        </div>
      </div>
    );
  return (
    <div
      className={cn(
        "field-registration bg-background text-foreground",
        step === 3 ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh",
      )}
    >
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <StayoLogo variant="white" className="h-9 w-auto" />
          <div className="text-right">
            <p className="text-sm font-semibold">Cadastro e vistoria</p>
            <p className="text-xs opacity-80">
              {values.condominium || "Novo imóvel"}
              {values.unit ? ` · ${values.unit}` : ""}
            </p>
          </div>
        </div>
      </header>
      <nav aria-label="Etapas do cadastro" className="border-b">
        <div className="mx-auto grid max-w-5xl grid-cols-4 gap-2 px-3 py-3">
          {steps.map((s, i) => (
            <Button
              key={s.title}
              variant="ghost"
              disabled={busy || i > step + 1}
              onClick={() => void go(i)}
              aria-current={step === i ? "step" : undefined}
              className={cn(
                "h-auto min-h-20 flex-col gap-2 rounded-lg border px-1 text-xs sm:text-sm",
                step === i
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full",
                  step === i ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {i < step ? <Check className="size-4" /> : <s.icon className="size-4" />}
              </span>
              <span className="whitespace-normal text-center">{s.title}</span>
            </Button>
          ))}
        </div>
      </nav>
      {step === 3 && inventoryReady ? (
        <>
          <div className="mx-auto max-w-5xl px-4 py-2">
            <Button
              variant="ghost"
              onClick={() => {
                void go(2);
              }}
            >
              <ChevronLeft className="size-4" />
              Quartos e camas
            </Button>
          </div>
          <SurveyExperience token={token} embedded />
        </>
      ) : (
        <>
          <main
            key={step}
            className="field-stage-enter mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-5 sm:pt-8"
          >
            <div className="mb-7 flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
                {step === 0 ? <UserRound /> : step === 1 ? <Building2 /> : <BedDouble />}
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Etapa {step + 1} de 4</p>
                <h1 className="text-2xl font-semibold text-primary">{steps[step]?.title}</h1>
              </div>
            </div>
            {step === 0 && (
              <div className="space-y-6">
                <Field label="Nome completo *" icon={<UserRound className="size-5" />}>
                  <Input
                    className="h-14 text-base"
                    autoComplete="name"
                    value={values.name}
                    disabled={record.contactLocked}
                    maxLength={200}
                    onChange={(e) => change({ name: e.target.value })}
                    onBlur={() => {
                      if (contactReady(values.name, values.phone)) void flush();
                    }}
                  />
                </Field>
                <Field label="WhatsApp *" icon={<Phone className="size-5" />}>
                  <Input
                    className="h-14 text-base"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(54) 99999-9999"
                    value={values.phone}
                    disabled={record.contactLocked}
                    onChange={(e) => change({ phone: e.target.value })}
                  />
                </Field>
                {record.contactLocked && (
                  <p className="text-sm text-muted-foreground">
                    Contato já vinculado. Alterações devem ser solicitadas à STAYO.
                  </p>
                )}
              </div>
            )}
            {step === 1 && (
              <div className="space-y-5">
                <Field label="Empreendimento *" icon={<Building2 className="size-5" />}>
                  <Input
                    className="h-14 text-base"
                    value={values.condominium}
                    disabled={record.condominiumLocked}
                    onChange={(e) => change({ condominium: e.target.value })}
                    placeholder="Escolha abaixo ou digite um novo"
                  />
                  {!record.condominiumLocked && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {KNOWN_CONDOMINIUMS.map((name) => {
                        const active = values.condominium.trim().toLowerCase() === name.toLowerCase();
                        return (
                          <button
                            key={name}
                            type="button"
                            aria-pressed={active}
                            onClick={() => change({ condominium: name })}
                            className="min-h-11 rounded-full border px-4 text-sm font-medium transition-colors"
                            style={active ? { background: "var(--stayo-navy)", color: "white", borderColor: "var(--stayo-navy)" } : { borderColor: "var(--stayo-border)", color: "var(--stayo-navy)" }}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Unidade *">
                    <Input
                      className="h-14 text-base"
                      value={values.unit}
                      onChange={(e) => change({ unit: e.target.value })}
                    />
                  </Field>
                  <Field label="Box / vaga">
                    <Input
                      className="h-14 text-base"
                      value={values.box}
                      onChange={(e) => change({ box: e.target.value })}
                    />
                  </Field>
                </div>
                <section className="space-y-2.5">
                  {(["bedrooms", "bathrooms", "lavatories"] as const).map((key, i) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                    >
                      <span className="flex items-center gap-2.5 font-semibold text-primary">
                        {i === 0 ? (
                          <BedDouble className="size-5" />
                        ) : i === 1 ? (
                          <Bath className="size-5" />
                        ) : (
                          <Toilet className="size-5" />
                        )}
                        {["Quartos", "Banheiros", "Lavabos"][i]}
                      </span>
                      <CompactCounter
                        label={["Quartos", "Banheiros", "Lavabos"][i] ?? key}
                        value={values[key]}
                        onChange={(n) => change({ [key]: n })}
                      />
                    </div>
                  ))}
                  <p className="px-1 text-xs text-muted-foreground">
                    Banheiros de suíte contam no total de banheiros do imóvel.
                  </p>
                </section>
                <details className="border-b pb-4">
                  <summary className="cursor-pointer py-3 font-semibold text-primary">
                    Wi-Fi · opcional
                  </summary>
                  <div className="space-y-4 pt-3">
                    <Field label="Nome da rede">
                      <Input
                        className="h-14"
                        value={values.wifiNetwork}
                        onChange={(e) => change({ wifiNetwork: e.target.value })}
                      />
                    </Field>
                    <Field label="Senha do Wi-Fi">
                      <div className="flex gap-2">
                        <Input
                          className="h-14"
                          autoComplete="off"
                          type={reveal ? "text" : "password"}
                          value={values.wifiPassword}
                          onChange={(e) => change({ wifiPassword: e.target.value })}
                        />
                        <Button
                          variant="outline"
                          className="size-14 shrink-0"
                          aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
                          onClick={() => setReveal(!reveal)}
                        >
                          {reveal ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </Field>
                  </div>
                </details>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-5">
                <div role="group" aria-label="Quarto" className="flex flex-wrap gap-2">
                  {values.rooms
                    .filter((r) => r.kind === "quarto")
                    .map((room) => {
                      const activeId = values.rooms.some(
                        (r) => r.id === selectedRoom && r.kind === "quarto",
                      )
                        ? selectedRoom
                        : values.rooms.find((r) => r.kind === "quarto")?.id;
                      return (
                        <Button
                          key={room.id}
                          variant="outline"
                          aria-pressed={activeId === room.id}
                          onClick={() => setSelectedRoom(room.id)}
                          className={cn(
                            "h-12 rounded-full px-5 shadow-none",
                            activeId === room.id &&
                              "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                          )}
                        >
                          <BedDouble />
                          {room.name}
                        </Button>
                      );
                    })}
                </div>
                {(() => {
                  const activeRoom = values.rooms.find(
                    (r) =>
                      r.kind === "quarto" &&
                      r.id ===
                        (values.rooms.some((x) => x.id === selectedRoom && x.kind === "quarto")
                          ? selectedRoom
                          : values.rooms.find((x) => x.kind === "quarto")?.id),
                  );
                  if (!activeRoom) return null;
                  return (
                    <Button
                      variant="outline"
                      aria-pressed={activeRoom.suite === true}
                      onClick={() =>
                        change({ suites: [{ roomId: activeRoom.id, suite: !activeRoom.suite }] })
                      }
                      className={cn(
                        "h-14 w-full justify-between rounded-lg px-4 text-base shadow-none",
                        activeRoom.suite && "border-primary bg-primary/5 text-primary",
                      )}
                    >
                      <span className="flex items-center gap-2.5 font-semibold">
                        <Bath className="size-5" />
                        Banheiro privativo (suíte)
                      </span>
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full border",
                          activeRoom.suite
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-transparent",
                        )}
                      >
                        <Check className="size-4" />
                      </span>
                    </Button>
                  );
                })()}
                {values.rooms
                  .filter(
                    (r) =>
                      r.kind === "quarto" &&
                      r.id ===
                        (values.rooms.some(
                          (room) => room.id === selectedRoom && room.kind === "quarto",
                        )
                          ? selectedRoom
                          : values.rooms.find((room) => room.kind === "quarto")?.id),
                  )
                  .map((room) => (
                    <section key={room.id} aria-label={room.name} className="field-stage-enter">
                      <div className="grid grid-cols-1 gap-2">
                        {bedTypes.map((type) => (
                          <BedSelectionCard
                            key={type}
                            type={type}
                            room={room.name}
                            value={room.items["camas"]?.opts?.[type] ?? 0}
                            onChange={(n) =>
                              change({
                                beds: values.rooms
                                  .filter((r) => r.kind === "quarto")
                                  .map((r) => ({
                                    roomId: r.id,
                                    options: {
                                      ...r.items["camas"]?.opts,
                                      ...(r.id === room.id ? { [type]: n } : {}),
                                    },
                                  })),
                              })
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                {values.bedrooms === 0 && (
                  <p className="text-muted-foreground">Nenhum quarto informado.</p>
                )}
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              >
                {error}
                <Button
                  variant="link"
                  className="mt-1 block px-0 text-destructive"
                  onClick={() => void flush()}
                >
                  Tentar salvar novamente
                </Button>
              </div>
            )}
          </main>
          <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
              <Button
                variant="outline"
                className="size-12 shrink-0"
                aria-label="Etapa anterior"
                disabled={step === 0 || busy}
                onClick={() => void go(step - 1)}
              >
                <ChevronLeft />
              </Button>
              <span role="status" className="min-w-0 flex-1 text-xs text-muted-foreground">
                {busy
                  ? "Salvando…"
                  : dirty
                    ? "Alterações pendentes"
                    : record.implementationId
                      ? "Ficha em andamento"
                      : ""}
              </span>
              <Button className="h-12 gap-2 px-5" disabled={busy} onClick={() => void go(step + 1)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {step === 2 ? "Iniciar vistoria" : "Continuar"}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
function Field({
  label,
  children,
  icon,
}: {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <label className={cn("block space-y-2", icon && "rounded-lg border bg-card p-4")}>
      <span className="flex items-center gap-2 text-sm font-medium text-primary">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
