import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, Loader2, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Drawer } from "../patterns/Drawer";
import { Button } from "../ui/button";
import { useAuthSession } from "../../lib/auth/session";
import {
  createOpportunity,
  findOpportunityContactDuplicates,
  type OpportunityContactCandidate,
} from "../../lib/api/opportunities";
import { coreApi, implementationsListQuery } from "../../lib/api/queries";
import { formatBrazilianPhone, normalizePhone } from "../../lib/owner-form-validation";

interface FormState {
  contactName: string;
  phone: string;
  title: string;
  existingOwnerId: string | null;
}

const emptyForm: FormState = {
  contactName: "",
  phone: "",
  title: "",
  existingOwnerId: null,
};

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

export function NewOpportunityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setRequestId(crypto.randomUUID());
  }, [open]);

  const normalizedPhone = normalizePhone(form.phone);
  const validPhone = /^55\d{10,11}$/.test(normalizedPhone);

  const duplicatesQuery = useQuery({
    queryKey: ["commercial", "opportunity", "duplicates", normalizedPhone],
    queryFn: () => findOpportunityContactDuplicates(normalizedPhone),
    enabled: open && validPhone,
    staleTime: 30_000,
    retry: 1,
  });

  const selectedCandidate = useMemo(
    () => (duplicatesQuery.data ?? []).find((candidate) => candidate.id === form.existingOwnerId) ?? null,
    [duplicatesQuery.data, form.existingOwnerId],
  );

  const valid =
    form.contactName.trim().length >= 3 && form.title.trim().length >= 3 && validPhone;

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await createOpportunity({
        contactName: form.contactName,
        phone: normalizedPhone,
        title: form.title,
        responsibleUserId: auth.profile?.id ?? null,
        existingOwnerId: form.existingOwnerId,
        requestId,
      });
      const created = await coreApi.implementations.get(result.implementationId);
      if (!created) throw new Error("A oportunidade foi criada, mas não pôde ser recarregada.");
      return created;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: implementationsListQuery().queryKey });
      queryClient.setQueryData(["implementations", "detail", created.id], created);
      toast.success("Oportunidade criada", {
        description: "Você pode completar proprietário, imóvel e proposta na mesma ficha.",
      });
      onClose();
      await navigate({ to: "/implantacao/$id", params: { id: created.id } });
    },
    onError: (error) => {
      toast.error("Não foi possível criar a oportunidade", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    },
  });

  const chooseCandidate = (candidate: OpportunityContactCandidate) => {
    setForm((current) => ({
      ...current,
      existingOwnerId: candidate.id,
      contactName: candidate.name,
      phone: formatBrazilianPhone(candidate.phone ?? current.phone),
    }));
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Comercial"
      title="Nova oportunidade"
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || mutation.isPending) return;
          mutation.mutate();
        }}
      >
        <div
          className="rounded-[var(--radius-card)] border px-4 py-3 text-sm"
          style={{ ...surface, color: "var(--stayo-ink-muted)" }}
        >
          Comece só com o que você já sabe. Condomínio, unidade, documentos e dados do imóvel
          ficam para depois.
        </div>

        <Field
          label="Nome do contato"
          value={form.contactName}
          autoComplete="name"
          placeholder="Ex.: Ana Martins"
          onChange={(value) =>
            setForm((current) => ({ ...current, contactName: value, existingOwnerId: null }))
          }
        />

        <Field
          label="Telefone"
          value={form.phone}
          inputMode="tel"
          autoComplete="tel"
          placeholder="(54) 99999-9999"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              phone: formatBrazilianPhone(value),
              existingOwnerId: null,
            }))
          }
        />

        {validPhone && (
          <DuplicateNotice
            loading={duplicatesQuery.isPending}
            error={duplicatesQuery.isError}
            candidates={duplicatesQuery.data ?? []}
            selected={selectedCandidate}
            onSelect={chooseCandidate}
            onCreateSeparate={() => setForm((current) => ({ ...current, existingOwnerId: null }))}
          />
        )}

        <Field
          label="Título provisório"
          value={form.title}
          placeholder="Ex.: Apartamento da Ana · oportunidade setembro"
          hint="É apenas uma referência comercial. Não cria condomínio, unidade ou imóvel operacional."
          onChange={(value) => setForm((current) => ({ ...current, title: value }))}
        />

        <div
          className="rounded-[var(--radius-card)] border p-4"
          style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-bg)" }}
        >
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 size-4 shrink-0" style={{ color: "var(--stayo-forest)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                Responsável
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {auth.profile?.id
                  ? "Você será definido como responsável inicial. Isso pode ser alterado depois na ficha."
                  : "A oportunidade será criada sem responsável definido."}
              </p>
            </div>
          </div>
        </div>

        {mutation.isError && (
          <div
            role="alert"
            className="rounded-[var(--radius-card)] border p-3 text-sm"
            style={{ borderColor: "var(--stayo-danger)", color: "var(--stayo-danger)" }}
          >
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Não foi possível salvar a oportunidade."}
          </div>
        )}

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!valid || mutation.isPending}
            className="min-w-40 bg-[var(--stayo-forest)] text-white hover:bg-[var(--stayo-forest)]/90"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Salvando…
              </>
            ) : (
              "Criar oportunidade"
            )}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function DuplicateNotice({
  loading,
  error,
  candidates,
  selected,
  onSelect,
  onCreateSeparate,
}: {
  loading: boolean;
  error: boolean;
  candidates: OpportunityContactCandidate[];
  selected: OpportunityContactCandidate | null;
  onSelect: (candidate: OpportunityContactCandidate) => void;
  onCreateSeparate: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        <Search className="size-3.5" /> Verificando contatos existentes…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--stayo-warning)" }}>
        <AlertTriangle className="size-3.5" /> Não foi possível verificar duplicidades agora.
      </div>
    );
  }
  if (candidates.length === 0) return null;

  return (
    <div
      className="rounded-[var(--radius-card)] border p-3"
      style={{ borderColor: "var(--stayo-warning)", backgroundColor: "var(--stayo-gold-soft)" }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--stayo-warning)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
            Possível contato já cadastrado
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Não fazemos união automática. Escolha um cadastro existente ou continue criando um novo.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelect(candidate)}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border bg-white px-3 py-2 text-left text-sm"
                style={{ borderColor: "var(--stayo-border)" }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium" style={{ color: "var(--stayo-ink)" }}>
                    {candidate.name}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {candidate.phone ? formatBrazilianPhone(candidate.phone) : "Telefone não informado"}
                  </span>
                </span>
                {selected?.id === candidate.id ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--stayo-success)" }}>
                    <Check className="size-3.5" /> Selecionado
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-medium" style={{ color: "var(--stayo-forest)" }}>
                    Usar cadastro
                  </span>
                )}
              </button>
            ))}
          </div>
          {selected && (
            <button
              type="button"
              onClick={onCreateSeparate}
              className="mt-3 text-xs font-medium underline"
              style={{ color: "var(--stayo-warning)" }}
            >
              Criar um novo contato mesmo assim
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  inputMode?: "text" | "tel" | "numeric" | "decimal";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[var(--stayo-forest)]/20"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
      {hint && (
        <span className="mt-1.5 block text-xs leading-5" style={{ color: "var(--stayo-ink-muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}
