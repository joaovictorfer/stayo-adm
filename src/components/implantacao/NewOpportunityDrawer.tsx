import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Drawer } from "../patterns/Drawer";
import { Button } from "../ui/button";
import { useAuthSession } from "../../lib/auth/session";
import { createOpportunity, findOpportunityContactDuplicates } from "../../lib/api/opportunities";
import { implementationsListQuery } from "../../lib/api/queries";
import { formatBrazilianPhone } from "../../lib/owner-form-validation";
import { validateContact, type ContactInput } from "../../lib/opportunity-journey";

const inputClass =
  "w-full min-h-12 rounded-[var(--radius-control)] border px-3 py-3 text-base outline-none transition focus:ring-2 focus:ring-[var(--stayo-forest)]/25";
const inputStyle = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
  color: "var(--stayo-ink)",
};

/**
 * Nova oportunidade — Etapa 1 de 5 (Contato). Nada é gravado até título,
 * nome e telefone estarem válidos; a criação é idempotente por requestId.
 * Depois, a jornada continua na ficha (?etapa=imovel).
 */
export function NewOpportunityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState<ContactInput>({ title: "", name: "", phone: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof ContactInput, boolean>>>({});
  const [existingOwnerId, setExistingOwnerId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRequestId(crypto.randomUUID());
    setForm({ title: "", name: "", phone: "" });
    setTouched({});
    setExistingOwnerId(null);
    setCreatedId(null);
  }, [open]);

  const errors = validateContact(form);
  const valid = Object.keys(errors).length === 0;
  const digits = form.phone.replace(/\D/g, "");

  const duplicates = useQuery({
    queryKey: ["opportunity", "duplicates", digits],
    queryFn: () => findOpportunityContactDuplicates(form.phone),
    enabled: open && !errors.phone,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: () =>
      createOpportunity({
        title: form.title,
        contactName: form.name,
        phone: form.phone,
        responsibleUserId: auth.profile?.id ?? null,
        existingOwnerId,
        requestId,
      }),
    onSuccess: async ({ implementationId }) => {
      setCreatedId(implementationId);
      await queryClient.invalidateQueries({ queryKey: implementationsListQuery().queryKey });
    },
  });

  const open_ = async (id: string, continueJourney: boolean) => {
    onClose();
    if (!continueJourney) window.sessionStorage.setItem(`opp-wizard-exit:${id}`, "1");
    await navigate({
      to: "/implantacao/$id",
      params: { id },
      search: continueJourney ? { etapa: "imovel" } : {},
    });
  };

  const field = (key: keyof ContactInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => {
    const err = touched[key] ? errors[key] : undefined;
    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
          {label} <span aria-hidden style={{ color: "var(--stayo-danger)" }}>*</span>
        </span>
        <input
          {...props}
          value={form[key]}
          disabled={Boolean(createdId)}
          aria-invalid={Boolean(err)}
          onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              [key]: key === "phone" ? formatBrazilianPhone(e.target.value) : e.target.value,
            }))
          }
          className={inputClass}
          style={{ ...inputStyle, borderColor: err ? "var(--stayo-danger)" : inputStyle.borderColor }}
        />
        {err && (
          <span className="mt-1 block text-xs" style={{ color: "var(--stayo-danger)" }}>
            {err}
          </span>
        )}
      </label>
    );
  };

  return (
    <Drawer open={open} onClose={onClose} eyebrow="Etapa 1 de 5 · Contato" title="Nova oportunidade">
      <div className="flex flex-col gap-5">
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full"
              style={{ backgroundColor: i === 0 ? "var(--stayo-forest)" : "var(--stayo-border)" }}
            />
          ))}
        </div>

        {!createdId ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched({ title: true, name: true, phone: true });
              if (valid && !create.isPending) create.mutate();
            }}
          >
            {field("title", "Título da implantação", { placeholder: "Ex.: Vêneto A201", autoFocus: true, maxLength: 140 })}
            {field("name", "Nome do proprietário", { placeholder: "Ex.: Bruna Haupenthal", autoComplete: "off", maxLength: 120 })}
            {field("phone", "Telefone / WhatsApp", { placeholder: "(51) 99999-9999", inputMode: "tel" })}

            {(duplicates.data?.length ?? 0) > 0 && (
              <div className="rounded-[var(--radius-card)] border p-3" style={inputStyle}>
                <p className="text-sm font-medium">Já existe contato com este telefone</p>
                <div className="mt-2 flex flex-col gap-2">
                  {duplicates.data!.map((d) => {
                    const active = existingOwnerId === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setExistingOwnerId(active ? null : d.id)}
                        className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border px-3 text-left text-sm"
                        style={{
                          borderColor: active ? "var(--stayo-forest)" : "var(--stayo-border)",
                          backgroundColor: active ? "var(--stayo-forest-soft)" : "transparent",
                        }}
                      >
                        {active ? <Check className="size-4" /> : <UserRound className="size-4" />}
                        <span className="min-w-0 flex-1 truncate">Usar {d.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {create.error && (
              <p role="alert" className="text-sm" style={{ color: "var(--stayo-danger)" }}>
                {create.error instanceof Error ? create.error.message : "Não foi possível criar."} Seus dados
                continuam aqui.
              </p>
            )}

            <div className="sticky bottom-0 -mx-1 mt-2 flex gap-2 bg-[var(--stayo-surface)] px-1 pb-1 pt-2">
              <Button type="button" variant="outline" className="min-h-12" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={create.isPending}
                className="min-h-12 flex-1 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90"
              >
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Continuar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-card)] border p-4" style={inputStyle}>
              <p className="flex items-center gap-2 font-medium">
                <Check className="size-4" style={{ color: "var(--stayo-forest)" }} />
                Já temos o necessário para criar esta oportunidade.
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                {form.title} · {form.name} · {form.phone}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void open_(createdId, true)}
              className="min-h-12 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90"
            >
              Continuar preenchendo
            </Button>
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void open_(createdId, false)}>
              Criar ficha agora
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
