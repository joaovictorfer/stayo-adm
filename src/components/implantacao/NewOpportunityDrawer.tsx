import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Drawer } from "../patterns/Drawer";
import { Button } from "../ui/button";
import { useAuthSession } from "../../lib/auth/session";
import { createDraftOpportunity } from "../../lib/api/opportunities";
import { implementationsListQuery } from "../../lib/api/queries";
import { opportunityTitle } from "../../lib/opportunity-state";
import { PathChooser, type OpportunityPath } from "./OpportunityPaths";

/** Ação inicial dentro do formulário único da oportunidade. */
export type OpportunityInitialAction = "dados" | "reuniao" | "convite";

const actionFor: Record<OpportunityPath, OpportunityInitialAction> = {
  manual: "dados",
  meeting: "reuniao",
  invite: "convite",
};

/**
 * Nova oportunidade: as três entradas abrem a MESMA oportunidade em rascunho
 * (um único requestId por abertura do painel — alternar entre elas não duplica)
 * e levam ao mesmo formulário progressivo na ficha.
 */
export function NewOpportunityDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuthSession();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [meetingChoice, setMeetingChoice] = useState(false);
  const [existingId, setExistingId] = useState("");

  useEffect(() => {
    if (!open) return;
    setRequestId(crypto.randomUUID());
    setMeetingChoice(false);
    setExistingId("");
  }, [open]);

  const list = useQuery({ ...implementationsListQuery(), enabled: open && meetingChoice });
  const openOpportunities = useMemo(
    () =>
      (list.data?.data ?? []).filter((i) =>
        ["prospect", "proposta", "aguardando_aprovacao"].includes(i.status),
      ),
    [list.data],
  );

  const go = async (id: string, acao: OpportunityInitialAction) => {
    onClose();
    await navigate({
      to: "/implantacao/$id",
      params: { id },
      search: { etapa: "proprietario", acao },
    });
  };

  const create = useMutation({
    mutationFn: (path: OpportunityPath) =>
      createDraftOpportunity({ responsibleUserId: auth.profile?.id ?? null, requestId }).then(
        (r) => ({ id: r.implementationId, path }),
      ),
    onSuccess: async ({ id, path }) => {
      await queryClient.invalidateQueries({ queryKey: implementationsListQuery().queryKey });
      await go(id, actionFor[path]);
    },
  });

  const choose = (path: OpportunityPath) => {
    if (path === "meeting") {
      setMeetingChoice(true);
      return;
    }
    create.mutate(path);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Comercial"
      title={meetingChoice ? "Agendar reunião" : "Nova oportunidade"}
    >
      {!meetingChoice ? (
        <div className="flex flex-col gap-4">
          <PathChooser onChoose={choose} />
          <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Qualquer opção abre a mesma oportunidade em rascunho, com identificação automática.
            Nenhum dado é obrigatório.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            A reunião fica na oportunidade. Use uma já existente ou abra uma nova.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
              Oportunidade existente
            </span>
            <select
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border px-3 py-2.5 text-sm"
              style={{
                backgroundColor: "var(--stayo-surface)",
                borderColor: "var(--stayo-border)",
                color: "var(--stayo-ink)",
              }}
            >
              <option value="">{list.isPending ? "Carregando…" : "Selecione"}</option>
              {openOpportunities.map((i) => (
                <option key={i.id} value={i.id}>
                  {opportunityTitle(i)} · {i.ownerName || "sem contato"} · {i.code}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setMeetingChoice(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!existingId}
              onClick={() => void go(existingId, "reuniao")}
            >
              Usar esta oportunidade
            </Button>
            <Button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate("meeting")}
              className="bg-[var(--stayo-forest)] text-white hover:bg-[var(--stayo-forest)]/90"
            >
              Abrir nova oportunidade
            </Button>
          </div>
        </div>
      )}
      {create.isPending && (
        <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          <Loader2 className="size-4 animate-spin" /> Abrindo rascunho…
        </p>
      )}
      {create.error && (
        <p role="alert" className="mt-4 text-sm" style={{ color: "var(--stayo-danger)" }}>
          {create.error instanceof Error ? create.error.message : "Não foi possível abrir."}
        </p>
      )}
    </Drawer>
  );
}
