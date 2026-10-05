import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { commercialProposalsApi } from "../../lib/api/commercial-proposals";
import { getSupabaseBrowserClient } from "../../lib/api/supabase-client";
import {
  blockLabel,
  hideBlock,
  listActiveReleases,
  releaseBlock,
  type DocumentsContent,
  type OverviewContent,
  type PortalBlock,
  type ProposalContent,
} from "../../lib/api/portal-visibility";
import {
  ReleasedDocumentsList,
  ReleasedOverview,
  ReleasedProposal,
} from "../portal/ReleasedBlocks";

const fmt = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(v));

type Attachment = {
  id: string;
  filename: string;
  mime_type: string;
  category: string;
  created_at: string;
};

async function listImplementationAttachments(implementationId: string): Promise<Attachment[]> {
  const db = getSupabaseBrowserClient();
  if (!db) return [];
  const { data, error } = await db
    .from("attachments")
    .select("id, filename, mime_type, category, created_at")
    .eq("implementation_id", implementationId)
    .is("inspection_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const NEVER = [
  "Acesso e fechadura",
  "Wi-Fi",
  "Códigos e senhas",
  "Dados bancários",
  "Notas internas",
];

export function OwnerVisibilityPanel({
  implementationId,
  defaultMessage,
}: {
  implementationId: string;
  defaultMessage: string;
}) {
  const qc = useQueryClient();
  const releasesQ = useQuery({
    queryKey: ["portal-visibility", implementationId],
    queryFn: () => listActiveReleases(implementationId),
  });
  const versionsQ = useQuery({
    queryKey: ["commercial", "proposals", implementationId],
    queryFn: () => commercialProposalsApi.list(implementationId),
  });
  const attachmentsQ = useQuery({
    queryKey: ["implementation-attachments", implementationId],
    queryFn: () => listImplementationAttachments(implementationId),
  });

  const published = (versionsQ.data ?? []).filter(
    (v) => v.snapshot && (v.status === "published" || v.status === "accepted"),
  );
  const released = (b: PortalBlock) => releasesQ.data?.find((r) => r.block === b);

  const [open, setOpen] = useState<PortalBlock | null>(null);
  const [overview, setOverview] = useState<OverviewContent>({
    title: "Resumo da implantação",
    message: defaultMessage,
    nextStep: null,
  });
  const [proposalId, setProposalId] = useState("");
  const [docIds, setDocIds] = useState<string[]>([]);

  const openDialog = (b: PortalBlock) => {
    if (b === "overview") {
      const cur = released("overview")?.content as OverviewContent | undefined;
      if (cur) setOverview(cur);
    }
    if (b === "proposal") setProposalId(published[0]?.id ?? "");
    if (b === "documents") setDocIds([]); // nunca pré-seleciona documento
    setOpen(b);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["portal-visibility", implementationId] });

  const release = useMutation({
    mutationFn: () =>
      releaseBlock({
        implementationId,
        block: open!,
        content:
          open === "overview"
            ? { ...overview }
            : open === "proposal"
              ? { proposalId }
              : { attachmentIds: docIds },
      }),
    onSuccess: async () => {
      setOpen(null);
      await refresh();
      toast.success("Visualização liberada ao proprietário");
    },
    onError: (e) => toast.error("Não foi possível liberar", { description: (e as Error).message }),
  });
  const hide = useMutation({
    mutationFn: (b: PortalBlock) => hideBlock(implementationId, b),
    onSuccess: async () => {
      await refresh();
      toast.success("Bloco voltou a ser privado");
    },
    onError: (e) => toast.error("Não foi possível ocultar", { description: (e as Error).message }),
  });

  const ready: Record<PortalBlock, boolean> = {
    overview: true,
    proposal: published.length > 0,
    documents: (attachmentsQ.data ?? []).length > 0,
  };
  const readyHint: Record<PortalBlock, string> = {
    overview: "Mensagem escrita pela equipe",
    proposal: published.length
      ? `${published.length} ${published.length === 1 ? "versão publicada" : "versões publicadas"}`
      : "Nenhuma versão publicada",
    documents: attachmentsQ.data?.length
      ? `${attachmentsQ.data.length} ${attachmentsQ.data.length === 1 ? "arquivo" : "arquivos"} na implantação`
      : "Nenhum arquivo anexado",
  };

  const selectedProposal = published.find((p) => p.id === proposalId);
  const selectedDocs: DocumentsContent = {
    documents: (attachmentsQ.data ?? [])
      .filter((a) => docIds.includes(a.id))
      .map((a) => ({
        attachmentId: a.id,
        filename: a.filename,
        mimeType: a.mime_type,
        category: a.category,
        createdAt: a.created_at,
      })),
  };
  const canConfirm =
    open === "overview"
      ? overview.message.trim().length >= 3
      : open === "proposal"
        ? Boolean(selectedProposal)
        : selectedDocs.documents.length > 0;

  return (
    <section
      className="rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--stayo-border)" }}
      aria-labelledby="owner-visibility-heading"
    >
      <p className="implementation-section-label">Portal</p>
      <h2 id="owner-visibility-heading" className="text-lg font-semibold text-[var(--stayo-ink)]">
        Visível ao proprietário
      </h2>
      <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
        O portal mostra apenas o que foi liberado aqui. Revisar um dado não libera a visualização.
      </p>

      <ul className="mt-4 divide-y divide-[var(--stayo-border)] rounded-[var(--radius-card)] border border-[var(--stayo-border)]">
        {(["overview", "proposal", "documents"] as PortalBlock[]).map((b) => {
          const r = released(b);
          const state = r ? "Publicado" : ready[b] ? "Pronto para publicação" : "Privado";
          return (
            <li key={b} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{blockLabel[b]}</p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: r
                        ? "var(--stayo-forest-soft)"
                        : ready[b]
                          ? "var(--stayo-gold-soft)"
                          : "var(--stayo-bg)",
                      color: r
                        ? "var(--stayo-success)"
                        : ready[b]
                          ? "var(--stayo-warning)"
                          : "var(--stayo-ink-muted)",
                    }}
                  >
                    {state}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--stayo-ink-muted)]">
                  {r
                    ? `Liberado por ${r.releasedByName ?? "equipe"} em ${fmt(r.releasedAt)}`
                    : readyHint[b]}
                </p>
              </div>
              <div className="flex gap-2">
                {r && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={hide.isPending}
                    onClick={() => hide.mutate(b)}
                  >
                    <EyeOff className="size-3.5" /> Tornar privado
                  </Button>
                )}
                <Button size="sm" disabled={!ready[b]} onClick={() => openDialog(b)}>
                  <Eye className="size-3.5" /> {r ? "Atualizar" : "Liberar visualização"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex gap-2 text-xs text-[var(--stayo-ink-muted)]">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        <span>Nunca publicados: {NEVER.join(", ")}.</span>
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Liberar “{open ? blockLabel[open] : ""}”</DialogTitle>
            <DialogDescription>
              Confira a prévia. É exatamente isto que o proprietário verá no portal.
            </DialogDescription>
          </DialogHeader>

          {open === "overview" && (
            <div className="space-y-2">
              <input
                className="stayo-commercial-input"
                value={overview.title}
                onChange={(e) => setOverview({ ...overview, title: e.target.value })}
                placeholder="Título"
              />
              <textarea
                className="stayo-commercial-input"
                rows={3}
                value={overview.message}
                onChange={(e) => setOverview({ ...overview, message: e.target.value })}
                placeholder="Mensagem"
              />
              <input
                className="stayo-commercial-input"
                value={overview.nextStep ?? ""}
                onChange={(e) => setOverview({ ...overview, nextStep: e.target.value || null })}
                placeholder="Próximo passo (opcional)"
              />
            </div>
          )}
          {open === "proposal" && (
            <select
              className="stayo-commercial-input"
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
            >
              {published.map((p) => (
                <option key={p.id} value={p.id}>
                  Versão {p.version}
                </option>
              ))}
            </select>
          )}
          {open === "documents" && (
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--stayo-ink-muted)]">
                Marque apenas os arquivos que podem ser vistos.
              </p>
              {(attachmentsQ.data ?? []).map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={docIds.includes(a.id)}
                    onChange={(e) =>
                      setDocIds((ids) =>
                        e.target.checked ? [...ids, a.id] : ids.filter((i) => i !== a.id),
                      )
                    }
                  />
                  <span className="truncate">{a.filename}</span>
                </label>
              ))}
            </div>
          )}

          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--stayo-border)] bg-[var(--stayo-bg)] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--stayo-ink-muted)]">
              <ShieldCheck className="size-3.5" /> Prévia exata
            </p>
            {open === "overview" && <ReleasedOverview content={overview} />}
            {open === "proposal" && selectedProposal?.snapshot && (
              <ReleasedProposal
                content={{ proposalId, snapshot: selectedProposal.snapshot } as ProposalContent}
              />
            )}
            {open === "documents" &&
              (selectedDocs.documents.length ? (
                <ReleasedDocumentsList content={selectedDocs} />
              ) : (
                <p className="text-sm text-[var(--stayo-ink-muted)]">Nenhum arquivo selecionado.</p>
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button disabled={!canConfirm || release.isPending} onClick={() => release.mutate()}>
              {release.isPending ? "Liberando…" : "Confirmar liberação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
