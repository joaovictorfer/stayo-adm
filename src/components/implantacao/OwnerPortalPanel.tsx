import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { Field } from "../data/ListStates";
import { adminApi, ownerOnboardingLinkQuery, ownerOnboardingSubmissionQuery } from "../../lib/api/queries";
import { commercialProposalsApi } from "../../lib/api/commercial-proposals";
import { countsInDefinedTotal } from "../../lib/proposal-pricing";
import { maskDocument, maskPixKey } from "../../lib/owner-form-validation";
import { ownerOnboardingLinkStatus, type OwnerOnboardingLinkStatus } from "../../types/owner-onboarding";
import type { CommercialProposalVersion } from "../../types/commercial-proposal";
import type { EntityId } from "../../types/core";

function ProposalGate({
  implementationId,
  pending,
  error,
  published,
  hasDraftChanges,
}: {
  implementationId: EntityId;
  pending: boolean;
  error: boolean;
  published: CommercialProposalVersion | null;
  hasDraftChanges: boolean;
}) {
  const navigate = useNavigate();
  const goToConditions = () => void navigate({ to: "/implantacao/$id", params: { id: implementationId }, search: { secao: "proposta" } });
  void implementationId;
  const box = "rounded-[var(--radius-control)] border p-3 text-sm";
  if (pending)
    return (
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Conferindo a proposta publicada…
      </p>
    );
  if (error)
    return (
      <p role="alert" className={box} style={{ borderColor: "var(--stayo-danger)" }}>
        Não foi possível conferir a proposta publicada. O envio fica bloqueado até confirmar.
      </p>
    );
  if (!published)
    return (
      <div
        role="status"
        className={box}
        style={{ borderColor: "var(--stayo-warning)", backgroundColor: "var(--stayo-gold-soft)" }}
      >
        <p className="font-medium" style={{ color: "var(--stayo-ink)" }}>
          Falta publicar as condições comerciais
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          A oportunidade continua em rascunho. Para enviar o link de acesso ao proprietário, revise e publique
          as condições; é a versão publicada que o proprietário verá no link.
        </p>
        <Button size="sm" variant="outline" className="mt-2 min-h-10" onClick={goToConditions}>
          Revisar e publicar condições
        </Button>
      </div>
    );
  const fixedTotal = published.snapshot?.items
    ? published.snapshot.items.reduce(
        (sum, i) => sum + (countsInDefinedTotal(i) ? Number(i.total) || 0 : 0),
        0,
      )
    : published.total;
  return (
    <div className={box} style={{ borderColor: "var(--stayo-border)" }}>
      <p className="font-medium" style={{ color: "var(--stayo-ink)" }}>
        Proposta disponível para o proprietário
        {published.status === "accepted" ? " (já confirmada)" : ""}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Publicada em{" "}
        {published.publishedAt
          ? new Date(published.publishedAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo",
            })
          : "—"}{" "}
        · {(published.snapshot?.items ?? published.items).length} {(published.snapshot?.items ?? published.items).length === 1 ? "serviço" : "serviços"} · valor definido{" "}
        {fixedTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
      {hasDraftChanges && (
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-warning)" }}>
          Há alterações em rascunho que ainda não aparecem no link. Publique uma nova versão para
          mostrá-las.
        </p>
      )}
      <Button variant="link" size="sm" className="mt-1 px-0" onClick={goToConditions}>
        Ver ou revisar condições
      </Button>
    </div>
  );
}

const invitationStatusLabels: Record<OwnerOnboardingLinkStatus, string> = {
  ativo: "Ativo",
  expirado: "Expirado",
  revogado: "Revogado",
  usado: "Usado",
};

const invitationStatusTone: Record<OwnerOnboardingLinkStatus, "neutral" | "danger" | "gold"> = {
  ativo: "neutral",
  expirado: "gold",
  revogado: "danger",
  usado: "neutral",
};

/**
 * Link de implantação do proprietário — único bloco com as três ações
 * (copiar link, copiar convite, acessar painel). A URL é sempre a externa
 * definitiva (/portal/implantacao/<token> ou, após criar a conta,
 * /portal/login); nunca a prévia interna e nunca só o ID da implantação.
 * O token é lido de uma tabela separada que só a equipe acessa e que é
 * apagada ao revogar/usar o convite.
 */
export function OwnerPortalPanel({
  implementationId,
  ownerId,
  ownerName,
  compact = false,
}: {
  compact?: boolean;
  implementationId: EntityId;
  ownerId: EntityId | null;
  ownerName: string | null;
}) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery(ownerOnboardingLinkQuery(implementationId));
  const submissionQuery = useQuery(ownerOnboardingSubmissionQuery(implementationId));
  const link = linkQuery.data;
  const status = link ? ownerOnboardingLinkStatus(link) : null;
  const tokenQuery = useQuery({
    queryKey: ["owner-onboarding", "link-token", link?.id],
    queryFn: () => link ? adminApi.ownerOnboarding.getLinkToken(link.id) : Promise.resolve(null),
    enabled: Boolean(link && status === "ativo"),
    staleTime: 60_000,
  });

  const invalidateLink = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["owner-onboarding", "link", implementationId],
    });
    await queryClient.invalidateQueries({ queryKey: ["owner-onboarding", "link-token"] });
  };

  const createLink = useMutation({
    mutationFn: () => adminApi.ownerOnboarding.createLink(implementationId, ownerId),
    onSuccess: async ({ link: created, token }) => {
      queryClient.setQueryData(["owner-onboarding", "link-token", created.id], token);
      await queryClient.invalidateQueries({
        queryKey: ["owner-onboarding", "link", implementationId],
      });
      toast.success("Link gerado", { description: "Qualquer link anterior foi desativado." });
    },
    onError: () => toast.error("Não foi possível gerar o link"),
  });

  const revokeLink = useMutation({
    mutationFn: (id: EntityId) => adminApi.ownerOnboarding.revoke(id),
    onSuccess: async () => {
      await invalidateLink();
      toast.success("Link revogado");
    },
    onError: () => toast.error("Não foi possível revogar o link"),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const token = status === "ativo" ? (tokenQuery.data ?? null) : null;
  const ownerUrl =
    status === "usado"
      ? `${origin}/portal/login`
      : token
        ? `${origin}/portal/implantacao/${token}`
        : null;
  const needsNewLink =
    !link ||
    status === "expirado" ||
    status === "revogado" ||
    (status === "ativo" && tokenQuery.isSuccess && !token);

  const rawFirstName = (ownerName ?? "").trim().split(/\s+/)[0] ?? "";
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toLocaleUpperCase("pt-BR") + rawFirstName.slice(1)
    : "";
  const defaultMessage = ownerUrl
    ? `${firstName ? `Oi, ${firstName}!` : "Oi!"} Confira sua proposta STAYO e, após confirmar as condições, preencha seus dados e os demais participantes para prepararmos o contrato. Você pode parar e continuar pelo mesmo link: ${ownerUrl}`
    : "";
  const [message, setMessage] = useState(defaultMessage);
  const [editingMessage, setEditingMessage] = useState(false);
  useEffect(() => {
    setMessage(defaultMessage);
  }, [defaultMessage]);

  const copy = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(success);
    } catch {
      toast.error("Não foi possível copiar", { description: "Selecione e copie manualmente." });
    }
  };

  const proposalsQuery = useQuery({
    queryKey: ["commercial-proposals", implementationId],
    queryFn: () => commercialProposalsApi.list(implementationId),
  });
  const versions = proposalsQuery.data ?? [];
  const published = versions
    .filter((v) => v.status === "published" || v.status === "accepted")
    .sort((a, b) => b.version - a.version)[0];
  const hasDraftChanges = versions.some(
    (v) => v.status === "draft" && (!published || v.updatedAt > (published.publishedAt ?? "")),
  );
  const canSend = status === "usado" || Boolean(published);

  const submission = submissionQuery.data;
  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : null;

  const steps: { label: string; done: boolean; detail: string }[] = [
    {
      label: "Link de acesso gerado",
      done: Boolean(link),
      detail: link ? (fmt(link.createdAt) ?? "") : "Ainda não gerado",
    },
    {
      label: "Acessado",
      done: Boolean(link?.lastAccessAt),
      detail: fmt(link?.lastAccessAt) ?? "Ainda não acessado",
    },
    {
      label: "Cadastro recebido",
      done: Boolean(submission?.submittedAt),
      detail: submission?.submittedAt
        ? (fmt(submission.submittedAt) ?? "")
        : submission
          ? "Em andamento"
          : "Aguardando",
    },
    {
      label: "Conta criada",
      done: status === "usado",
      detail: status === "usado" ? (fmt(link?.usedAt) ?? "") : "Aguardando",
    },
  ];

  const statusDetail = !link
    ? "Nenhum link gerado"
    : status === "ativo"
      ? `Válido até ${fmt(link.expiresAt)}`
      : status === "revogado"
        ? `Revogado em ${fmt(link.revokedAt)}`
        : status === "expirado"
          ? `Venceu em ${fmt(link.expiresAt)}`
          : `Conta criada em ${fmt(link.usedAt)} · acesso pelo login`;

  return (
    <section
      aria-labelledby="owner-link-title"
      className={compact ? "min-w-0 rounded-lg border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-4 text-[var(--stayo-navy)]" : "rounded-[var(--radius-card)] border-2 bg-white p-4 shadow-sm sm:p-5"}
      style={compact ? undefined : { borderColor: "var(--stayo-forest)" }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="owner-link-title"
            className="text-base font-semibold"
            style={{ fontFamily: compact ? "Outfit, sans-serif" : "var(--stayo-font-display)", color: "var(--stayo-navy)" }}
          >
             {status === "usado" ? "Portal do proprietário" : "Link de acesso do proprietário"}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            {linkQuery.isPending ? "Verificando link…" : statusDetail}
          </p>
        </div>
        {status && (
          <Tag label={invitationStatusLabels[status]} tone={invitationStatusTone[status]} />
        )}
      </div>

      <div className="mt-4">
        {linkQuery.isError ? (
          <p className="text-sm text-[var(--stayo-danger)]">
            Não foi possível verificar o link agora.{" "}
            <Button variant="link" size="sm" onClick={() => void linkQuery.refetch()}>
              Tentar de novo
            </Button>
          </p>
        ) : linkQuery.isPending || (status === "ativo" && tokenQuery.isPending) ? (
          <div className="h-11 animate-pulse rounded-[var(--radius-control)] bg-[var(--stayo-surface-muted,#f1efe9)]" />
        ) : tokenQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">Não foi possível recuperar o link. <Button variant="link" size="sm" onClick={() => void tokenQuery.refetch()}>Tentar novamente</Button></p>
        ) : needsNewLink ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              {status === "ativo"
                ? "Este link foi criado antes de a equipe poder copiá-lo de novo. Gere um novo para continuar."
                : "Ainda não há um link válido para o proprietário."}
            </p>
            <Button
              onClick={() => createLink.mutate()}
              disabled={createLink.isPending || proposalsQuery.isPending || proposalsQuery.isError || !canSend}
              className="min-h-11"
            >
               <Send /> {createLink.isPending ? "Gerando…" : "Gerar link de acesso"}
            </Button>
          </div>
        ) : ownerUrl ? (
          <>
            {status !== "usado" && <ProposalGate
              implementationId={implementationId}
              pending={proposalsQuery.isPending}
              error={proposalsQuery.isError}
              published={published ?? null}
              hasDraftChanges={hasDraftChanges}
            />}
            <div className={compact ? "mt-3 flex flex-wrap gap-2" : "mt-3 grid gap-2 sm:grid-cols-3"}>
              <Button
                className="min-h-11"
                disabled={!canSend || tokenQuery.isError || createLink.isPending || revokeLink.isPending}
                onClick={() => void copy(ownerUrl, "Link copiado")}
              >
                <Copy /> Copiar link
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={!canSend || tokenQuery.isError || createLink.isPending || revokeLink.isPending}
                onClick={() => void copy(message, "Mensagem copiada")}
              >
                <Copy /> Copiar mensagem
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <a
                  href={ownerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abre a jornada real deste proprietário em nova aba"
                >
                   <ExternalLink /> {status === "usado" ? "Abrir Portal" : "Abrir jornada"}
                </a>
              </Button>
            </div>
            <details className="mt-3">
            {<summary className="cursor-pointer text-xs text-[var(--stayo-ink-muted)]">Ver mensagem para WhatsApp</summary>}
            <div
              className="mt-3 rounded-[var(--radius-control)] border p-3"
              style={{ borderColor: "var(--stayo-border)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
                  Mensagem do link de acesso (WhatsApp)
                </span>
                <Button variant="link" size="sm"
                  onClick={() => setEditingMessage((v) => !v)}
                >
                  {editingMessage ? "Pronto" : "Editar"}
                </Button>
              </div>
              {editingMessage ? (
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  aria-label="Mensagem do link de acesso"
                  className="mt-2 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-1 text-sm break-words" style={{ color: "var(--stayo-ink)" }}>
                  {message}
                </p>
              )}
              <p className="mt-2 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
                Copiar não envia nada. Cole a mensagem no WhatsApp do proprietário.
              </p>
            </div>
            </details>
          </>
        ) : null}
      </div>

      {!compact && <ol
        className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 sm:grid-cols-4"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        {steps.map((step) => (
          <li key={step.label} className="flex min-w-0 items-start gap-2">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--stayo-success)]" />
            ) : (
              <span
                className="mt-0.5 size-4 shrink-0 rounded-full border"
                style={{ borderColor: "var(--stayo-border-strong)" }}
              />
            )}
            <span className="min-w-0">
              <span className="block text-xs font-medium" style={{ color: "var(--stayo-ink)" }}>
                {step.label}
              </span>
              <span
                className="block truncate text-[11px]"
                style={{ color: "var(--stayo-ink-muted)" }}
              >
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {status === "ativo" && link && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="link" size="sm" disabled={revokeLink.isPending} className="px-0 text-destructive"
              >
                Revogar link
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revogar o link do proprietário?</AlertDialogTitle>
                <AlertDialogDescription>
                  O link deixa de funcionar na hora. Você pode gerar um novo depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => revokeLink.mutate(link.id)}>
                  Confirmar revogação
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {status === "ativo" && !needsNewLink && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="link" size="sm" className="px-0" disabled={createLink.isPending || !canSend}>Gerar novo link</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Substituir o link atual?</AlertDialogTitle><AlertDialogDescription>O link anterior deixará de funcionar. Copie e compartilhe o novo link com o proprietário.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => createLink.mutate()}>Gerar novo link</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        )}
        <Link
          to="/portal/previa/$id"
          params={{ id: implementationId }}
          target="_blank"
          rel="noreferrer"
          className="ml-auto underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Prévia interna (só equipe)
        </Link>
      </div>

      {!compact && submission && (
        <details
          open
          className="mt-3 rounded-[var(--radius-control)] border p-3"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          <summary className="cursor-pointer text-xs font-medium">
            {submission.submittedAt
              ? "Dados enviados pelo proprietário — revisar"
              : "Preenchido pelo proprietário (em andamento) — revisar"}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nome completo" value={submission.fullName} />
            <Field label="Documento" value={maskDocument(submission.document)} />
            <Field label="E-mail" value={submission.email} />
            <Field label="Telefone" value={submission.phone} />
            <Field label="Chave Pix" value={maskPixKey(submission.pixKey)} />
            <Field label="Recebido em" value={submission.submittedAt} />
          </div>
        </details>
      )}
    </section>
  );
}

function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" | "gold" }) {
  const tones = {
    neutral: { backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" },
    danger: { backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-danger)" },
    gold: { backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" },
  } as const;
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px]" style={tones[tone]}>
      {label}
    </span>
  );
}
