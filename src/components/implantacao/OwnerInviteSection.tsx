import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, Link2, Lock, MessageCircle, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { commercialProposalsApi } from "../../lib/api/commercial-proposals";
import {
  inviteStatus,
  presentationInvitesApi,
  presentationUrl,
  whatsappMessage,
  type PresentationInviteStatus,
} from "../../lib/api/presentation-invites";
import { ProposalPresentationView } from "./ProposalPresentationView";

const statusLabel: Record<PresentationInviteStatus, string> = {
  active: "Ativo",
  expired: "Expirado",
  revoked: "Revogado",
};

const fmt = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(v))
    : "—";

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
    return true;
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    return false;
  }
}

export function OwnerInviteSection({
  implementationId,
  ownerName,
}: {
  implementationId: string;
  ownerName: string | null;
}) {
  const queryClient = useQueryClient();
  const versionsQ = useQuery({
    queryKey: ["commercial", "proposals", implementationId],
    queryFn: () => commercialProposalsApi.list(implementationId),
  });
  const invitesQ = useQuery({
    queryKey: ["presentation-invites", implementationId],
    queryFn: () => presentationInvitesApi.list(implementationId),
  });

  const published = useMemo(
    () =>
      (versionsQ.data ?? []).filter(
        (v) => v.snapshot && (v.status === "published" || v.status === "accepted"),
      ),
    [versionsQ.data],
  );
  const [selectedId, setSelectedId] = useState("");
  const [validDays, setValidDays] = useState(15);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);

  useEffect(() => {
    if (!selectedId && published[0]) setSelectedId(published[0].id);
  }, [published, selectedId]);

  const selected = published.find((v) => v.id === selectedId) ?? null;
  const link = token ? presentationUrl(token) : null;
  useEffect(() => {
    if (link) setMessage(whatsappMessage(ownerName, link));
  }, [link, ownerName]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["presentation-invites", implementationId] });

  const issue = useMutation({
    mutationFn: () =>
      presentationInvitesApi.issue({ implementationId, proposalId: selectedId, validDays }),
    onSuccess: async (r) => {
      setToken(r.token);
      setPreviewOpen(false);
      await refresh();
      toast.success("Convite publicado");
    },
    onError: (e) =>
      toast.error("Não foi possível publicar o convite", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });
  const revoke = useMutation({
    mutationFn: (proposalId: string) => presentationInvitesApi.revoke(proposalId),
    onSuccess: async () => {
      setToken(null);
      await refresh();
      toast.success("Convite revogado");
    },
  });

  const current = invitesQ.data?.find((i) => inviteStatus(i) === "active") ?? invitesQ.data?.[0];
  const currentStatus = current ? inviteStatus(current) : null;
  const currentVersion = current
    ? (versionsQ.data ?? []).find((v) => v.id === current.proposalId)?.version
    : null;

  const blocked = versionsQ.isError || invitesQ.isError;

  return (
    <section
      className="rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--stayo-border)" }}
      aria-labelledby="owner-invite-heading"
    >
      <p className="implementation-section-label">Comercial</p>
      <h2 id="owner-invite-heading" className="text-lg font-semibold text-[var(--stayo-ink)]">
        Convite do proprietário
      </h2>
      <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
        Link exclusivo desta oportunidade, somente para ver a proposta. Não permite aceitar nem
        editar dados. Nada é enviado automaticamente.
      </p>

      {blocked ? (
        <div className="mt-4 flex gap-2 rounded-[var(--radius-card)] border border-[var(--stayo-danger)] p-3 text-sm text-[var(--stayo-danger)]">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Bloqueado: seu perfil não tem acesso às propostas ou aos links desta oportunidade.
        </div>
      ) : (
        <>
          {current && currentStatus && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-bg)] px-3 py-2.5 text-xs text-[var(--stayo-ink-muted)]">
              <span
                className="rounded-full px-2 py-0.5 font-medium"
                style={{
                  color:
                    currentStatus === "active" ? "var(--stayo-success)" : "var(--stayo-danger)",
                  backgroundColor: "var(--stayo-surface)",
                }}
              >
                {statusLabel[currentStatus]}
              </span>
              <span>Versão {currentVersion ?? "?"}</span>
              <span>Gerado em {fmt(current.createdAt)}</span>
              <span>Expira em {fmt(current.expiresAt)}</span>
              {current.revokedAt && <span>Revogado em {fmt(current.revokedAt)}</span>}
              {currentStatus === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(current.proposalId)}
                >
                  <ShieldOff className="size-3.5" /> Revogar
                </Button>
              )}
            </div>
          )}

          {versionsQ.isPending ? (
            <p className="mt-4 text-sm text-[var(--stayo-ink-muted)]">Carregando versões…</p>
          ) : published.length === 0 ? (
            <div className="mt-4 flex gap-2 rounded-[var(--radius-card)] border border-[var(--stayo-warning)] bg-[var(--stayo-gold-soft)] p-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0 text-[var(--stayo-warning)]" />
              Bloqueado: nenhuma versão da proposta foi publicada. Publique uma versão na aba
              Proposta para liberar o convite.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
              <label className="block text-xs font-medium text-[var(--stayo-ink-muted)]">
                Versão que a pessoa poderá ver
                <select
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setPreviewOpen(false);
                  }}
                  className="stayo-commercial-input mt-1"
                >
                  {published.map((v) => (
                    <option key={v.id} value={v.id}>
                      Versão {v.version} · publicada {fmt(v.publishedAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[var(--stayo-ink-muted)]">
                Validade
                <select
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value))}
                  className="stayo-commercial-input mt-1"
                >
                  {[7, 15, 30].map((d) => (
                    <option key={d} value={d}>
                      {d} dias
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="outline" onClick={() => setPreviewOpen((o) => !o)}>
                <Eye className="size-4" /> {previewOpen ? "Fechar prévia" : "Ver prévia"}
              </Button>
            </div>
          )}

          {previewOpen && selected?.snapshot && (
            <div className="mt-4 rounded-[var(--radius-card)] border border-dashed border-[var(--stayo-border)] p-4">
              <p className="mb-3 text-xs font-medium text-[var(--stayo-ink-muted)]">
                Prévia: exatamente estes dados ficarão visíveis pelo link.
              </p>
              <ProposalPresentationView snapshot={selected.snapshot} />
              <div className="mt-4 flex flex-col gap-2 border-t border-[var(--stayo-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--stayo-ink-muted)]">
                  Publicar gera um link novo e desativa qualquer link anterior desta oportunidade.
                </p>
                <Button disabled={issue.isPending} onClick={() => issue.mutate()}>
                  <Link2 className="size-4" />
                  {issue.isPending ? "Publicando…" : "Publicar convite"}
                </Button>
              </div>
            </div>
          )}

          {link && (
            <div className="mt-4 space-y-3 rounded-[var(--radius-card)] border border-[var(--stayo-success)] bg-[var(--stayo-forest-soft)] p-4">
              <p className="text-xs text-[var(--stayo-ink-muted)]">
                Copie agora: por segurança o link não fica guardado. Se perder, publique de novo.
              </p>
              <input
                readOnly
                value={link}
                className="stayo-commercial-input"
                onFocus={(e) => e.target.select()}
              />
              <label className="block text-xs font-medium text-[var(--stayo-ink-muted)]">
                Mensagem para WhatsApp (editável)
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="stayo-commercial-input mt-1"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (await copy(link, "Link")) setCopied("link");
                  }}
                >
                  {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === "link" ? "Link copiado" : "Copiar link"}
                </Button>
                <Button
                  onClick={async () => {
                    if (await copy(message, "Mensagem")) setCopied("msg");
                  }}
                >
                  {copied === "msg" ? (
                    <Check className="size-4" />
                  ) : (
                    <MessageCircle className="size-4" />
                  )}
                  {copied === "msg" ? "Mensagem copiada" : "Copiar mensagem para WhatsApp"}
                </Button>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-[var(--stayo-ink-muted)]">
            Este link não permite preencher cadastro. Para isso, gere o link de cadastro no card
            “Dados recebidos” abaixo — é outro acesso, e os dois nunca se misturam.
          </p>
        </>
      )}
    </section>
  );
}
