import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Plus, Save, Send, Trash2 } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { commercialTermsQuery, implementationQuery } from "../../lib/api/queries";
import { commercialProposalsApi } from "../../lib/api/commercial-proposals";
import { generatePublishedProposalPdf } from "../../lib/pdf/proposal-pdf";
import type { EntityId, ProposalItem } from "../../types/core";
import type {
  CommercialProposalSnapshot,
  CommercialProposalStatus,
  CommercialProposalVersion,
  ProposalRequiredSignatory,
} from "../../types/commercial-proposal";

interface DraftItem {
  description: string;
  quantity: number;
  unitValue: number;
  discount: number;
}

const emptyItem: DraftItem = {
  description: "",
  quantity: 1,
  unitValue: 0,
  discount: 0,
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const statusLabels: Record<CommercialProposalStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  accepted: "Aceita",
  superseded: "Substituída",
};

function lineTotal(item: DraftItem): number {
  return Math.max(0, item.quantity * item.unitValue - item.discount);
}

function toProposalItems(items: DraftItem[]): ProposalItem[] {
  return items
    .filter((item) => item.description.trim().length > 0)
    .map((item) => ({
      description: item.description.trim(),
      quantity: item.quantity,
      unitValue: item.unitValue,
      discount: item.discount,
      total: lineTotal(item),
    }));
}

function fromProposalItems(items: ProposalItem[]): DraftItem[] {
  return items.length > 0
    ? items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitValue: item.unitValue,
        discount: item.discount,
      }))
    : [{ ...emptyItem }];
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function signatories(value: string): ProposalRequiredSignatory[] {
  return lines(value).map((line) => {
    const [label = "", role] = line.split("|", 2).map((part) => part.trim());
    return { label, role: role || null };
  });
}

function signatoriesText(value: ProposalRequiredSignatory[]): string {
  return value.map((item) => `${item.label}${item.role ? ` | ${item.role}` : ""}`).join("\n");
}

function statusTone(status: CommercialProposalStatus) {
  if (status === "accepted")
    return { color: "var(--stayo-success)", backgroundColor: "var(--stayo-forest-soft)" };
  if (status === "published")
    return { color: "var(--stayo-forest)", backgroundColor: "var(--stayo-forest-soft)" };
  if (status === "superseded")
    return { color: "var(--stayo-ink-muted)", backgroundColor: "var(--stayo-bg-soft)" };
  return { color: "var(--stayo-warning)", backgroundColor: "var(--stayo-warning-soft)" };
}

function proposalError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.toLowerCase().includes("sem permissão")) {
    return "Você não tem permissão para acessar ou alterar propostas comerciais.";
  }
  if (message.toLowerCase().includes("conflito")) {
    return "A proposta mudou em outra sessão. Recarregue antes de continuar.";
  }
  return message || "Não foi possível carregar as propostas.";
}

export function ProposalTab({ implementationId }: { implementationId: EntityId }) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    queryKey: ["commercial-proposals", implementationId],
    queryFn: () => commercialProposalsApi.list(implementationId),
  });
  const implementationQueryResult = useQuery(implementationQuery(implementationId));
  const commercialTerms = useQuery(commercialTermsQuery(implementationId));

  const versions = versionsQuery.data ?? [];
  const draftVersion = versions.find((version) => version.status === "draft") ?? null;
  const latestPublished = versions.find((version) => version.status !== "draft") ?? null;

  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }]);
  const [responsibilitiesText, setResponsibilitiesText] = useState("");
  const [signatoriesValue, setSignatoriesValue] = useState("");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [previewId, setPreviewId] = useState<string | "draft" | null>(null);

  useEffect(() => {
    const source = draftVersion ?? latestPublished;
    const key = source
      ? `${source.id}:${source.status}:${source.draftRevision}:${source.updatedAt}`
      : "empty";
    if (key === loadedKey) return;

    if (draftVersion) {
      setItems(fromProposalItems(draftVersion.items));
      setResponsibilitiesText(draftVersion.draftResponsibilities.join("\n"));
      setSignatoriesValue(signatoriesText(draftVersion.requiredSignatories));
    } else if (latestPublished?.snapshot) {
      setItems(fromProposalItems(latestPublished.snapshot.items));
      setResponsibilitiesText(latestPublished.snapshot.responsibilities.join("\n"));
      setSignatoriesValue(signatoriesText(latestPublished.snapshot.requiredSignatories));
    } else {
      setItems([{ ...emptyItem }]);
      setResponsibilitiesText("");
      setSignatoriesValue("");
    }

    setLoadedKey(key);
    setDirty(false);
  }, [draftVersion, latestPublished, loadedKey]);

  const proposalItems = useMemo(() => toProposalItems(items), [items]);
  const total = proposalItems.reduce((sum, item) => sum + item.total, 0);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["commercial-proposals", implementationId] });
  };

  const saveDraft = useMutation({
    mutationFn: () =>
      commercialProposalsApi.saveDraft({
        proposalId: draftVersion?.id ?? null,
        implementationId,
        expectedRevision: draftVersion?.draftRevision ?? null,
        items: proposalItems,
        responsibilities: lines(responsibilitiesText),
        requiredSignatories: signatories(signatoriesValue),
        commandId: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      setDirty(false);
      await invalidate();
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      const saved = await commercialProposalsApi.saveDraft({
        proposalId: draftVersion?.id ?? null,
        implementationId,
        expectedRevision: draftVersion?.draftRevision ?? null,
        items: proposalItems,
        responsibilities: lines(responsibilitiesText),
        requiredSignatories: signatories(signatoriesValue),
        commandId: crypto.randomUUID(),
      });
      return commercialProposalsApi.publish({
        proposalId: saved.id,
        expectedRevision: saved.draftRevision,
        commandId: crypto.randomUUID(),
      });
    },
    onSuccess: async (version) => {
      setDirty(false);
      setPreviewId(version.id);
      await invalidate();
    },
  });

  const pdf = useMutation({
    mutationFn: async (version: CommercialProposalVersion) => {
      if (!version.snapshot) throw new Error("Esta versão ainda não possui snapshot publicado.");
      const bytes = await generatePublishedProposalPdf({ snapshot: version.snapshot });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `proposta-${implementationQueryResult.data?.code ?? implementationId}-v${version.version}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
    setDirty(true);
  };

  const removeItem = (index: number) => {
    setItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [{ ...emptyItem }];
    });
    setDirty(true);
  };

  if (versionsQuery.isLoading) {
    return (
      <div className="rounded-[var(--radius-card)] border bg-white p-6 text-sm text-muted-foreground">
        Carregando propostas…
      </div>
    );
  }

  if (versionsQuery.isError) {
    return (
      <div className="rounded-[var(--radius-card)] border bg-white p-6">
        <p className="text-sm font-medium text-destructive">{proposalError(versionsQuery.error)}</p>
        <Button className="mt-4" variant="outline" onClick={() => void versionsQuery.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const selectedVersion =
    previewId && previewId !== "draft"
      ? (versions.find((version) => version.id === previewId) ?? null)
      : null;
  const selectedSnapshot = selectedVersion?.snapshot ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Proposta comercial
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {draftVersion
                ? `Versão ${draftVersion.version} em rascunho`
                : latestPublished
                  ? `Preparar versão ${latestPublished.version + 1}`
                  : "Preparar primeira versão"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              O rascunho é interno. Ao publicar, itens, condições, responsabilidades, conteúdo e
              signatários são congelados em um snapshot imutável.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewId("draft")}>
              <Eye className="mr-2 h-4 w-4" />
              Prévia
            </Button>
            <Button
              variant="outline"
              disabled={
                saveDraft.isPending ||
                publish.isPending ||
                proposalItems.length === 0 ||
                (!dirty && Boolean(draftVersion))
              }
              onClick={() => saveDraft.mutate()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveDraft.isPending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button
              disabled={publish.isPending || saveDraft.isPending || proposalItems.length === 0}
              onClick={() => publish.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              {publish.isPending ? "Publicando…" : "Publicar versão"}
            </Button>
          </div>
        </div>

        {(saveDraft.isError || publish.isError) && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {proposalError(saveDraft.error ?? publish.error)}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Serviços e valores</h3>
            <p className="text-sm text-muted-foreground">
              Edite apenas o draft atual. Versões publicadas não são alteradas.
            </p>
          </div>
          <strong className="text-sm">{currency.format(total)}</strong>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_90px_130px_130px_auto] sm:items-end"
            >
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Serviço
                <Input
                  value={item.description}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                  placeholder="Ex.: Taxa de implantação"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Qtd.
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, { quantity: Number(event.target.value) || 0 })
                  }
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Valor unitário
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitValue}
                  onChange={(event) =>
                    updateItem(index, { unitValue: Number(event.target.value) || 0 })
                  }
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Desconto
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discount}
                  onChange={(event) =>
                    updateItem(index, { discount: Number(event.target.value) || 0 })
                  }
                />
              </label>
              <button
                type="button"
                aria-label="Remover item"
                className="flex h-10 w-10 items-center justify-center rounded-md border text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <Button
          className="mt-3"
          variant="outline"
          size="sm"
          onClick={() => {
            setItems((current) => [...current, { ...emptyItem }]);
            setDirty(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar item
        </Button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5">
          <h3 className="font-semibold">Responsabilidades apresentadas</h3>
          <p className="mt-1 text-sm text-muted-foreground">Uma responsabilidade por linha.</p>
          <Textarea
            className="mt-3 min-h-36"
            value={responsibilitiesText}
            placeholder="Ex.: STAYO realiza cadastro e configuração inicial dos canais"
            onChange={(event) => {
              setResponsibilitiesText(event.target.value);
              setDirty(true);
            }}
          />
        </section>

        <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5">
          <h3 className="font-semibold">Signatários comerciais exigidos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Um por linha. Use “Nome ou papel | função” quando precisar registrar a função. Isto não
            cria assinatura de contrato.
          </p>
          <Textarea
            className="mt-3 min-h-36"
            value={signatoriesValue}
            placeholder="Proprietário titular | proprietário"
            onChange={(event) => {
              setSignatoriesValue(event.target.value);
              setDirty(true);
            }}
          />
        </section>
      </div>

      <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Condições que serão congeladas na publicação</h3>
        {commercialTerms.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando condições…</p>
        ) : commercialTerms.isError ? (
          <p className="mt-3 text-sm text-destructive">
            Não foi possível carregar as condições comerciais. Não publique até corrigir.
          </p>
        ) : (commercialTerms.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma condição comercial cadastrada. As condições contratuais da ficha também serão
            capturadas no snapshot quando existirem.
          </p>
        ) : (
          <div className="mt-3 divide-y rounded-lg border">
            {(commercialTerms.data ?? []).map((term) => (
              <div
                key={term.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span>{term.label}</span>
                <strong>
                  {term.chargeType === "percentage"
                    ? `${term.value}%`
                    : currency.format(term.value)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {(previewId === "draft" || selectedVersion) && (
        <ProposalPreview
          title={
            previewId === "draft"
              ? "Prévia do rascunho"
              : `Prévia da versão ${selectedVersion?.version}`
          }
          items={previewId === "draft" ? proposalItems : (selectedSnapshot?.items ?? [])}
          total={previewId === "draft" ? total : (selectedSnapshot?.total ?? 0)}
          responsibilities={
            previewId === "draft"
              ? lines(responsibilitiesText)
              : (selectedSnapshot?.responsibilities ?? [])
          }
          signatories={
            previewId === "draft"
              ? signatories(signatoriesValue)
              : (selectedSnapshot?.requiredSignatories ?? [])
          }
          snapshot={previewId === "draft" ? null : selectedSnapshot}
          onClose={() => setPreviewId(null)}
        />
      )}

      <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="font-semibold">Histórico de versões</h3>
          <p className="text-sm text-muted-foreground">
            Versões publicadas permanecem imutáveis. Uma nova negociação gera outra versão.
          </p>
        </div>

        {versions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma versão criada. O primeiro salvamento criará a versão 1 como rascunho.
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>Versão {version.version}</strong>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={statusTone(version.status)}
                    >
                      {statusLabels[version.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {version.publishedAt
                      ? `Publicada em ${new Date(version.publishedAt).toLocaleString("pt-BR")}`
                      : `Atualizada em ${new Date(version.updatedAt).toLocaleString("pt-BR")}`}
                    {version.acceptedAt
                      ? ` · aceite comercial em ${new Date(version.acceptedAt).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewId(version.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver
                  </Button>
                  {version.snapshot && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pdf.isPending}
                      onClick={() => pdf.mutate(version)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProposalPreview({
  title,
  items,
  total,
  responsibilities,
  signatories: requiredSignatories,
  snapshot,
  onClose,
}: {
  title: string;
  items: ProposalItem[];
  total: number;
  responsibilities: string[];
  signatories: ProposalRequiredSignatory[];
  snapshot: CommercialProposalSnapshot | null;
  onClose: () => void;
}) {
  return (
    <section
      className="rounded-[var(--radius-card)] border-2 bg-white p-4 sm:p-5"
      style={{ borderColor: "var(--stayo-forest)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--stayo-forest)" }}
          >
            Prévia interna
          </p>
          <h3 className="mt-1 text-lg font-semibold">{title}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="mt-4 divide-y rounded-lg border">
        {items.map((item, index) => (
          <div
            key={`${item.description}-${index}`}
            className="flex flex-wrap justify-between gap-3 px-3 py-3 text-sm"
          >
            <span>
              {item.description} · {item.quantity}x
            </span>
            <strong>{currency.format(item.total)}</strong>
          </div>
        ))}
        <div className="flex justify-between gap-3 px-3 py-3 text-sm font-semibold">
          <span>Total</span>
          <span>{currency.format(total)}</span>
        </div>
      </div>

      {snapshot?.commercialTerms && snapshot.commercialTerms.length > 0 && (
        <PreviewList
          title="Condições comerciais"
          values={snapshot.commercialTerms.map(
            (term) =>
              `${term.label}: ${term.chargeType === "percentage" ? `${term.value}%` : currency.format(term.value)}`,
          )}
        />
      )}
      {responsibilities.length > 0 && (
        <PreviewList title="Responsabilidades" values={responsibilities} />
      )}
      {requiredSignatories.length > 0 && (
        <PreviewList
          title="Signatários comerciais"
          values={requiredSignatories.map(
            (item) => `${item.label}${item.role ? ` — ${item.role}` : ""}`,
          )}
        />
      )}

      {!snapshot && (
        <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Esta é a prévia do rascunho. As condições comerciais, condições contratuais e blocos de
          conteúdo vigentes serão congelados pelo servidor no momento da publicação.
        </p>
      )}
    </section>
  );
}

function PreviewList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {values.map((value, index) => (
          <li key={`${value}-${index}`}>• {value}</li>
        ))}
      </ul>
    </div>
  );
}
