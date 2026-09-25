import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Loader2, Mail, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { useAuthSession } from "../../lib/auth/session";
import { commercialMeetingsApi } from "../../lib/api/commercial-meetings";
import { createInviteOpportunity, createOpportunity } from "../../lib/api/opportunities";
import { coreApi, implementationsListQuery } from "../../lib/api/queries";
import { opportunityTitle } from "../../lib/opportunity-state";
import { formatBrazilianPhone, normalizePhone } from "../../lib/owner-form-validation";
import type { CommercialMeetingMode } from "../../types/commercial-journey";

export type OpportunityPath = "manual" | "meeting" | "invite";

const TIME_ZONE = "America/Sao_Paulo";

const inputClass =
  "w-full rounded-[var(--radius-control)] border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[var(--stayo-forest)]/20";
const inputStyle = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
  color: "var(--stayo-ink)",
};
const primaryBtn = "min-w-40 bg-[var(--stayo-forest)] text-white hover:bg-[var(--stayo-forest)]/90";

export function PathChooser({ onChoose }: { onChoose: (path: OpportunityPath) => void }) {
  const options: Array<{
    path: OpportunityPath;
    icon: typeof UserPlus;
    title: string;
    text: string;
  }> = [
    {
      path: "manual",
      icon: UserPlus,
      title: "Cadastrar proprietário",
      text: "Preencha nome, telefone e título agora.",
    },
    {
      path: "meeting",
      icon: CalendarClock,
      title: "Agendar reunião",
      text: "Crie ou escolha uma oportunidade e registre a reunião.",
    },
    {
      path: "invite",
      icon: Mail,
      title: "Convidar proprietário para cadastro",
      text: "Prepare a oportunidade sem dados do proprietário ou do imóvel.",
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        Como você quer começar?
      </p>
      {options.map(({ path, icon: Icon, title, text }) => (
        <button
          key={path}
          type="button"
          onClick={() => onChoose(path)}
          className="group flex items-center gap-3 rounded-[var(--radius-card)] border p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--stayo-forest)]"
          style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
        >
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}
          >
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
              {title}
            </span>
            <span className="mt-0.5 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {text}
            </span>
          </span>
          <ChevronRight
            className="size-4 shrink-0 transition group-hover:translate-x-0.5"
            style={{ color: "var(--stayo-ink-muted)" }}
          />
        </button>
      ))}
    </div>
  );
}

function useAssignees(enabled: boolean) {
  return useQuery({
    queryKey: ["commercial", "assignees"],
    queryFn: () => commercialMeetingsApi.listAssignees(),
    enabled,
    staleTime: 60_000,
  });
}

function Label({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
      {children} {optional && <span className="font-normal">(opcional)</span>}
    </span>
  );
}

function ResponsibleSelect({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  allowEmpty: boolean;
}) {
  const assignees = useAssignees(true);
  const list = assignees.data ?? [];
  const valueMissing = !value || !list.some((a) => a.id === value);
  const firstId = list[0]?.id;
  // A required select shows its first option even when state is empty; sync state to it.
  useEffect(() => {
    if (!allowEmpty && valueMissing && firstId) onChange(firstId);
  }, [allowEmpty, valueMissing, firstId, onChange]);
  return (
    <label className="block">
      <Label optional={allowEmpty}>Responsável interno</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        {allowEmpty && <option value="">A definir</option>}
        {(assignees.data ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {a.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}

function Actions({
  onBack,
  pending,
  disabled,
  label,
}: {
  onBack: () => void;
  pending: boolean;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
        Voltar
      </Button>
      <Button type="submit" disabled={disabled || pending} className={primaryBtn}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Salvando…
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-card)] border p-3 text-sm"
      style={{ borderColor: "var(--stayo-danger)", color: "var(--stayo-danger)" }}
    >
      {error instanceof Error ? error.message : "Não foi possível salvar."}
    </div>
  );
}

function useFinish(onClose: () => void) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async (implementationId: string, message: string) => {
    const created = await coreApi.implementations.get(implementationId);
    await queryClient.invalidateQueries({ queryKey: implementationsListQuery().queryKey });
    await queryClient.invalidateQueries({ queryKey: ["commercial", "overview"] });
    if (created) queryClient.setQueryData(["implementations", "detail", created.id], created);
    toast.success(message);
    onClose();
    await navigate({ to: "/implantacao/$id", params: { id: implementationId } });
  };
}

export function InvitePath({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const auth = useAuthSession();
  const [title, setTitle] = useState("");
  const [responsible, setResponsible] = useState(auth.profile?.id ?? "");
  const [requestId] = useState(() => crypto.randomUUID());
  const finish = useFinish(onClose);

  const mutation = useMutation({
    mutationFn: () =>
      createInviteOpportunity({ title, responsibleUserId: responsible || null, requestId }),
    onSuccess: (r) => finish(r.implementationId, "Convite preparado"),
  });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mutation.isPending) mutation.mutate();
      }}
    >
      <div
        className="rounded-[var(--radius-card)] border px-4 py-3 text-sm"
        style={{ ...inputStyle, color: "var(--stayo-ink-muted)" }}
      >
        Nenhum dado do proprietário ou do imóvel é necessário. O próprio proprietário preenche pelo
        convite.
      </div>
      <label className="block">
        <Label optional>Título comercial provisório</Label>
        <input
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Indicação do corretor · Centro"
          className={inputClass}
          style={inputStyle}
        />
        <span className="mt-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Se ficar em branco, a oportunidade recebe uma identificação como “Convite · IMP-00012”.
        </span>
      </label>
      <ResponsibleSelect value={responsible} onChange={setResponsible} allowEmpty />
      <ErrorBox error={mutation.error} />
      <Actions
        onBack={onBack}
        pending={mutation.isPending}
        disabled={false}
        label="Preparar convite"
      />
    </form>
  );
}

export function MeetingPath({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const auth = useAuthSession();
  const [source, setSource] = useState<"existing" | "new">("existing");
  const [existingId, setExistingId] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [mode, setMode] = useState<CommercialMeetingMode>("video");
  const [joinUrl, setJoinUrl] = useState("");
  const [responsible, setResponsible] = useState(auth.profile?.id ?? "");
  const [requestId] = useState(() => crypto.randomUUID());
  const [createdId, setCreatedId] = useState<string | null>(null);
  const finish = useFinish(onClose);

  const list = useQuery(implementationsListQuery());
  const openOpportunities = useMemo(
    () =>
      (list.data?.data ?? []).filter((i) =>
        ["prospect", "proposta", "aguardando_aprovacao"].includes(i.status),
      ),
    [list.data],
  );

  const validPhone = /^55\d{10,11}$/.test(normalizePhone(phone));
  const validSource =
    source === "existing"
      ? !!existingId
      : contactName.trim().length >= 3 && title.trim().length >= 3 && validPhone;
  const valid = validSource && !!startsAtLocal && !!responsible;

  const mutation = useMutation({
    mutationFn: async () => {
      let implementationId = source === "existing" ? existingId : createdId;
      if (!implementationId) {
        const r = await createOpportunity({
          contactName,
          phone,
          title,
          responsibleUserId: responsible || null,
          existingOwnerId: null,
          requestId,
        });
        implementationId = r.implementationId;
        setCreatedId(implementationId);
      }
      await commercialMeetingsApi.schedule({
        implementationId,
        startsAtLocal,
        timeZone: TIME_ZONE,
        mode,
        joinUrl: mode === "video" ? joinUrl : null,
        responsibleUserId: responsible,
      });
      return implementationId;
    },
    onSuccess: (id) => finish(id, "Reunião agendada"),
  });

  const tab = (value: "existing" | "new", label: string) => (
    <button
      type="button"
      onClick={() => setSource(value)}
      disabled={!!createdId}
      className="flex-1 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition"
      style={
        source === value
          ? { backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }
          : { color: "var(--stayo-ink-muted)" }
      }
    >
      {label}
    </button>
  );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !mutation.isPending) mutation.mutate();
      }}
    >
      <div
        className="flex gap-1 rounded-[var(--radius-card)] border p-1"
        style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-bg)" }}
      >
        {tab("existing", "Oportunidade existente")}
        {tab("new", "Nova oportunidade")}
      </div>

      {source === "existing" ? (
        <label className="block">
          <Label>Oportunidade</Label>
          <select
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">{list.isPending ? "Carregando…" : "Selecione"}</option>
            {openOpportunities.map((i) => (
              <option key={i.id} value={i.id}>
                {opportunityTitle(i)} · {i.ownerName || "sem contato"} · {i.code}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="block">
            <Label>Nome do contato</Label>
            <input
              value={contactName}
              disabled={!!createdId}
              onChange={(e) => setContactName(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </label>
          <label className="block">
            <Label>Telefone</Label>
            <input
              value={phone}
              inputMode="tel"
              disabled={!!createdId}
              placeholder="(54) 99999-9999"
              onChange={(e) => setPhone(formatBrazilianPhone(e.target.value))}
              className={inputClass}
              style={inputStyle}
            />
          </label>
          <label className="block">
            <Label>Título provisório</Label>
            <input
              value={title}
              disabled={!!createdId}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Label>Data e hora</Label>
          <input
            type="datetime-local"
            value={startsAtLocal}
            onChange={(e) => setStartsAtLocal(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <Label>Formato</Label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CommercialMeetingMode)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="video">Vídeo</option>
            <option value="in_person">Presencial</option>
          </select>
        </label>
      </div>
      {mode === "video" && (
        <label className="block">
          <Label optional>Link da reunião</Label>
          <input
            value={joinUrl}
            type="url"
            onChange={(e) => setJoinUrl(e.target.value)}
            placeholder="https://"
            className={inputClass}
            style={inputStyle}
          />
        </label>
      )}
      <ResponsibleSelect value={responsible} onChange={setResponsible} allowEmpty={false} />
      {createdId && (
        <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          A oportunidade já foi criada; tentar de novo apenas agenda a reunião.
        </p>
      )}
      <ErrorBox error={mutation.error} />
      <Actions
        onBack={onBack}
        pending={mutation.isPending}
        disabled={!valid}
        label="Agendar reunião"
      />
    </form>
  );
}
