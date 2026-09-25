import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Clock, Copy, Inbox, Link2, MessageCircle, PencilLine, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import {
  intakeStatusLabel,
  intakeUrl,
  intakeWhatsappMessage,
  ownerIntakeAdminApi,
  propertyTypeLabel,
  type OfficialSnapshot,
  type OwnerIntakeData,
} from "../../lib/api/owner-intake";

const fmt = (v: string | null | undefined) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(v))
    : "—";

const FIELDS: Array<{ key: keyof OwnerIntakeData & keyof OfficialSnapshot; label: string }> = [
  { key: "fullName", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "locationName", label: "Condomínio / prédio" },
  { key: "unitLabel", label: "Unidade" },
  { key: "city", label: "Cidade" },
  { key: "district", label: "Bairro" },
  { key: "postalCode", label: "CEP" },
  { key: "propertyType", label: "Tipo" },
  { key: "bedrooms", label: "Quartos" },
  { key: "bathrooms", label: "Banheiros" },
  { key: "capacity", label: "Capacidade" },
];

const show = (key: string, v: unknown) =>
  v === null || v === undefined || v === ""
    ? "—"
    : key === "propertyType"
      ? propertyTypeLabel(String(v))
      : String(v);

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
    return true;
  } catch {
    toast.error("Não foi possível copiar.");
    return false;
  }
}

export function OwnerIntakeReview({
  implementationId,
  ownerName,
}: {
  implementationId: string;
  ownerName: string | null;
}) {
  const qc = useQueryClient();
  const linkQ = useQuery({
    queryKey: ["owner-intake", "link", implementationId],
    queryFn: () => ownerIntakeAdminApi.currentLink(implementationId),
  });
  const subQ = useQuery({
    queryKey: ["owner-intake", "submission", implementationId],
    queryFn: () => ownerIntakeAdminApi.submission(implementationId),
    refetchInterval: 15_000,
  });
  const officialQ = useQuery({
    queryKey: ["owner-intake", "official", implementationId],
    queryFn: () => ownerIntakeAdminApi.official(implementationId),
    enabled: Boolean(subQ.data),
  });

  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [correcting, setCorrecting] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["owner-intake"] });

  const issue = useMutation({
    mutationFn: () => ownerIntakeAdminApi.issue(implementationId, 15),
    onSuccess: async (t) => {
      setToken(t);
      setMessage(intakeWhatsappMessage(ownerName, intakeUrl(t)));
      await refresh();
      toast.success("Link de cadastro gerado");
    },
    onError: (e) => toast.error("Não foi possível gerar o link", { description: (e as Error).message }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => ownerIntakeAdminApi.revoke(id),
    onSuccess: async () => {
      setToken(null);
      await refresh();
      toast.success("Link desativado");
    },
  });
  const review = useMutation({
    mutationFn: (decision: "approve" | "request_correction" | "keep_pending") =>
      ownerIntakeAdminApi.review({ implementationId, decision, note: note.trim() || undefined }),
    onSuccess: async (_, decision) => {
      setCorrecting(false);
      setNote("");
      await refresh();
      await qc.invalidateQueries({ queryKey: ["implementation", implementationId] });
      await qc.invalidateQueries({ queryKey: ["implementations"] });
      toast.success(
        decision === "approve"
          ? "Dados aprovados e aplicados à ficha"
          : decision === "request_correction"
            ? "Correção solicitada ao proprietário"
            : "Mantido pendente",
      );
    },
    onError: (e) => toast.error("Não foi possível registrar a decisão", { description: (e as Error).message }),
  });

  const link = linkQ.data;
  const linkState = !link
    ? null
    : link.revokedAt
      ? "Desativado"
      : new Date(link.expiresAt) < new Date()
        ? "Expirado"
        : "Ativo";
  const sub = subQ.data;
  const official = officialQ.data;
  const url = token ? intakeUrl(token) : null;

  return (
    <section
      className="rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--stayo-border)" }}
      aria-labelledby="owner-intake-heading"
    >
      <p className="implementation-section-label">Dados recebidos</p>
      <h2 id="owner-intake-heading" className="text-lg font-semibold text-[var(--stayo-ink)]">
        Cadastro enviado pelo proprietário
      </h2>
      <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
        Link curto e exclusivo desta oportunidade: contato, localização e características do imóvel.
        Não pede dados bancários, documentos, senhas ou Wi-Fi. Nada entra na ficha sem aprovação.
      </p>

      {/* Link */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-bg)] px-3 py-2.5 text-xs text-[var(--stayo-ink-muted)]">
        {link ? (
          <>
            <span className="font-medium text-[var(--stayo-ink)]">Link {linkState}</span>
            <span>Gerado em {fmt(link.createdAt)}</span>
            <span>Expira em {fmt(link.expiresAt)}</span>
            {link.lastAccessAt && <span>Último acesso {fmt(link.lastAccessAt)}</span>}
          </>
        ) : (
          <span>Nenhum link de cadastro gerado.</span>
        )}
        <div className="ml-auto flex gap-2">
          {link && linkState === "Ativo" && (
            <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(link.id)}>
              <ShieldOff className="size-3.5" /> Desativar
            </Button>
          )}
          <Button size="sm" disabled={issue.isPending} onClick={() => issue.mutate()}>
            <Link2 className="size-3.5" /> {link ? "Gerar novo link" : "Gerar link de cadastro"}
          </Button>
        </div>
      </div>

      {url && (
        <div className="mt-3 space-y-3 rounded-[var(--radius-card)] border border-[var(--stayo-success)] bg-[var(--stayo-forest-soft)] p-4">
          <p className="text-xs text-[var(--stayo-ink-muted)]">
            Copie agora: por segurança o link não fica guardado. Vale por 15 dias.
          </p>
          <input readOnly value={url} className="stayo-commercial-input" onFocus={(e) => e.target.select()} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="stayo-commercial-input" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={async () => (await copy(url, "Link")) && setCopied("link")}>
              {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === "link" ? "Link copiado" : "Copiar link"}
            </Button>
            <Button onClick={async () => (await copy(message, "Mensagem")) && setCopied("msg")}>
              {copied === "msg" ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
              {copied === "msg" ? "Mensagem copiada" : "Copiar mensagem para WhatsApp"}
            </Button>
          </div>
        </div>
      )}

      {/* Recebidos */}
      {subQ.isPending ? (
        <p className="mt-4 text-sm text-[var(--stayo-ink-muted)]">Carregando…</p>
      ) : subQ.isError ? (
        <p className="mt-4 text-sm text-[var(--stayo-danger)]">Seu perfil não tem acesso aos dados recebidos.</p>
      ) : !sub ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--stayo-ink-muted)]">
          <Inbox className="size-4" /> Nenhum dado recebido ainda.
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-full px-2.5 py-0.5 font-semibold"
              style={{
                background: sub.status === "submitted" ? "var(--stayo-gold-soft)" : "var(--stayo-bg)",
                color:
                  sub.status === "approved"
                    ? "var(--stayo-success)"
                    : sub.status === "submitted"
                      ? "var(--stayo-warning)"
                      : "var(--stayo-ink-muted)",
              }}
            >
              {sub.status === "submitted" ? "Recebido · Pendente de revisão" : intakeStatusLabel[sub.status]}
            </span>
            <span className="text-[var(--stayo-ink-muted)]">
              Origem: link de cadastro comercial · {sub.submittedAt ? `enviado em ${fmt(sub.submittedAt)}` : `rascunho salvo em ${fmt(sub.updatedAt)}`}
            </span>
          </div>
          {sub.reviewedAt && (
            <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
              Última decisão por {sub.reviewedByName ?? "equipe"} em {fmt(sub.reviewedAt)}
              {sub.reviewNote ? ` — “${sub.reviewNote}”` : ""}
            </p>
          )}

          <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--stayo-border)]">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-[var(--stayo-bg)] text-left text-xs text-[var(--stayo-ink-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Campo</th>
                  <th className="px-3 py-2 font-medium">Recebido</th>
                  <th className="px-3 py-2 font-medium">Atual na ficha</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(({ key, label }) => {
                  const received = sub.data[key];
                  const current = official?.[key];
                  const differs =
                    received !== undefined && received !== "" && norm(received) !== norm(current);
                  return (
                    <tr key={key} className="border-t border-[var(--stayo-border)]">
                      <td className="px-3 py-2 text-xs text-[var(--stayo-ink-muted)]">{label}</td>
                      <td className={`px-3 py-2 ${differs ? "font-semibold text-[var(--stayo-ink)]" : ""}`}>
                        {show(key, received)}
                        {differs && <span className="ml-1.5 text-[10px] font-medium text-[var(--stayo-warning)]">diferente</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--stayo-ink-muted)]">
                        {officialQ.isPending ? "…" : show(key, current)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sub.data.notes && (
            <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--stayo-bg)] p-3 text-sm">
              <span className="text-xs text-[var(--stayo-ink-muted)]">Observações do proprietário: </span>
              {sub.data.notes}
            </p>
          )}

          {sub.status === "submitted" && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-[var(--stayo-ink-muted)]">
                Aprovar aplica os dados do imóvel à ficha e só preenche nome, telefone e e-mail do
                proprietário quando estiverem vazios. Não cria imóvel no STAYO APP e não libera nada no portal.
              </p>
              {correcting && (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="O que o proprietário precisa corrigir? (ele verá esta mensagem)"
                  className="stayo-commercial-input"
                />
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button disabled={review.isPending} onClick={() => review.mutate("approve")}>
                  <CheckCircle2 className="size-4" /> Aprovar
                </Button>
                <Button
                  variant="outline"
                  disabled={review.isPending || (correcting && note.trim().length < 3)}
                  onClick={() => (correcting ? review.mutate("request_correction") : setCorrecting(true))}
                >
                  <PencilLine className="size-4" /> {correcting ? "Enviar pedido de correção" : "Solicitar correção"}
                </Button>
                <Button variant="ghost" disabled={review.isPending} onClick={() => review.mutate("keep_pending")}>
                  <Clock className="size-4" /> Manter pendente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
