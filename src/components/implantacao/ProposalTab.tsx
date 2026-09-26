import { conditionPendingIssues, contractRowToSnapshot } from "../../lib/contract-conditions";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, FileText, Info, Plus, Save, Send, Trash2 } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { supabase } from "../../integrations/supabase/client";
import { commercialTermsQuery, implementationQuery } from "../../lib/api/queries";
import { commercialProposalsApi } from "../../lib/api/commercial-proposals";
import { generatePublishedProposalPdf } from "../../lib/pdf/proposal-pdf";
import { formatBRL, roundCents } from "../../lib/money";
import { MoneyInput } from "./MoneyInput";
import {
  PRICING_LABELS,
  countsInDefinedTotal,
  pricingIssues,
  resolvePricing,
  type ItemPricing,
} from "../../lib/proposal-pricing";
import { ContractConditionsPanel } from "./ContractConditionsPanel";
import { ImplementationDecisionsPanel } from "./ImplementationDecisionsPanel";
import { ProposalPresentationView } from "./ProposalPresentationView";
import {
  PROPOSAL_ITEM_TEMPLATES,
  type ProposalItemTemplate,
} from "../../config/proposal-item-templates";
import type { EntityId, ProposalItem } from "../../types/core";
import type {
  CommercialProposalSnapshot,
  CommercialProposalStatus,
  CommercialProposalVersion,
  ProposalItemOption,
  ProposalRequiredSignatory,
} from "../../types/commercial-proposal";

// ---------------------------------------------------------------------------
// Modelo local
// ---------------------------------------------------------------------------

interface DraftItem extends ProposalItemOption {
  uid: string;
}

type Party = "STAYO" | "Proprietário" | "Ambos";
interface Responsibility {
  uid: string;
  party: Party;
  text: string;
}
interface Signatory {
  uid: string;
  label: string;
  role: string;
}

const PARTIES: Party[] = ["STAYO", "Proprietário", "Ambos"];
const ROLES = [
  "Proprietário titular",
  "Coproprietário",
  "Cônjuge",
  "Procurador",
  "Representante legal",
  "Outro",
];

const uid = () => crypto.randomUUID();
const newItem = (): DraftItem => ({
  uid: uid(),
  description: "",
  quantity: 1,
  unitValue: 0,
  discount: 0,
  included: true,
  optional: false,
  templateKey: null,
  details: "",
  scope: [],
});

const cleanScope = (scope: string[] | undefined) =>
  (scope ?? []).map((x) => x.trim()).filter(Boolean);

function fromTemplate(t: ProposalItemTemplate): DraftItem {
  // Cópia independente do modelo, desligada: nada entra no total sem ação da equipe.
  return {
    uid: uid(),
    description: t.description,
    quantity: 1,
    unitValue: t.unitValue,
    discount: 0,
    included: false,
    optional: false,
    templateKey: t.key,
    details: t.details,
    scope: [...t.scope],
  };
}

const statusLabels: Record<CommercialProposalStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  accepted: "Aceita",
  superseded: "Substituída",
};

const gross = (i: DraftItem) => roundCents(i.quantity * i.unitValue);
const lineTotal = (i: DraftItem) => roundCents(Math.max(0, gross(i) - i.discount));

function toProposalItems(items: DraftItem[]): ProposalItem[] {
  return items
    .filter((i) => i.included && i.description.trim())
    .map((i) => ({
      description: i.description.trim(),
      quantity: i.quantity,
      unitValue: roundCents(i.unitValue),
      discount: roundCents(Math.min(i.discount, gross(i))),
      total: lineTotal(i),
      details: i.details?.trim() || null,
      scope: cleanScope(i.scope),
      pricing: resolvePricing(i),
    }));
}

function toOptions(items: DraftItem[]): ProposalItemOption[] {
  return items
    .filter((i) => i.description.trim())
    .map(({ uid: _u, ...rest }) => ({
      ...rest,
      description: rest.description.trim(),
      details: rest.details?.trim() || null,
      scope: cleanScope(rest.scope),
    }));
}

function fromVersion(
  v: CommercialProposalVersion | null,
  fallbackItems: ProposalItem[],
): DraftItem[] {
  const opts = v?.draftItemOptions;
  if (opts && opts.length)
    return opts.map((o) => ({ ...o, details: o.details ?? "", scope: o.scope ?? [], uid: uid() }));
  const base = v ? v.items : fallbackItems;
  return base.length
    ? base.map((i) => ({
        uid: uid(),
        description: i.description,
        quantity: i.quantity,
        unitValue: i.unitValue,
        discount: i.discount,
        included: true,
        optional: false,
        templateKey: null,
        details: i.details ?? "",
        scope: i.scope ?? [],
        pricing: i.pricing ?? null,
      }))
    : [];
}

function parseResponsibility(line: string): Responsibility {
  const match = /^(STAYO|Proprietário|Ambos):\s*(.*)$/.exec(line);
  return match
    ? { uid: uid(), party: match[1] as Party, text: match[2] ?? "" }
    : { uid: uid(), party: "STAYO", text: line };
}
const serializeResponsibilities = (list: Responsibility[]) =>
  list.filter((r) => r.text.trim()).map((r) => `${r.party}: ${r.text.trim()}`);
const serializeSignatories = (list: Signatory[]): ProposalRequiredSignatory[] =>
  list.filter((s) => s.label.trim()).map((s) => ({ label: s.label.trim(), role: s.role || null }));

function proposalError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.toLowerCase().includes("sem permissão"))
    return "Você não tem permissão para acessar ou alterar propostas comerciais.";
  if (message.toLowerCase().includes("conflito"))
    return "A proposta mudou em outra sessão. Recarregue antes de continuar.";
  return message || "Não foi possível carregar as propostas.";
}

const card = "rounded-[var(--radius-card)] border bg-white p-4 sm:p-5";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--stayo-forest)]";

// ---------------------------------------------------------------------------

export function ProposalTab({ implementationId }: { implementationId: EntityId }) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    queryKey: ["commercial-proposals", implementationId],
    queryFn: () => commercialProposalsApi.list(implementationId),
  });
  const implementationQueryResult = useQuery(implementationQuery(implementationId));
  const commercialTerms = useQuery(commercialTermsQuery(implementationId));
  const contractQuery = useQuery({
    queryKey: ["implementation-contract-conditions", implementationId, "proposal-preview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_contract_conditions")
        .select("*")
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const contentQuery = useQuery({
    queryKey: ["proposal-content-blocks", implementationId, "proposta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_content_blocks")
        .select("title, body, display_order")
        .eq("implementation_id", implementationId)
        .eq("visibility", "proposta")
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const versions = versionsQuery.data ?? [];
  const draftVersion = versions.find((v) => v.status === "draft") ?? null;
  const latestPublished = versions.find((v) => v.status !== "draft") ?? null;
  // A lista completa (com desligados) e o objeto só persistem após a migration 0025.
  const optionsSupported = true;

  const [items, setItems] = useState<DraftItem[]>([]);
  const [partnershipObject, setPartnershipObject] = useState("");
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [signatoriesList, setSignatoriesList] = useState<Signatory[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [previewId, setPreviewId] = useState<string | "draft" | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    const source = draftVersion ?? latestPublished;
    const key = source
      ? `${source.id}:${source.status}:${source.draftRevision}:${source.updatedAt}`
      : "empty";
    if (key === loadedKey) return;
    const snap = !draftVersion ? latestPublished?.snapshot : null;
    setItems(fromVersion(draftVersion, snap?.items ?? []));
    setPartnershipObject(draftVersion?.draftPartnershipObject ?? snap?.partnershipObject ?? "");
    setResponsibilities(
      (draftVersion?.draftResponsibilities ?? snap?.responsibilities ?? []).map(
        parseResponsibility,
      ),
    );
    setSignatoriesList(
      (draftVersion?.requiredSignatories ?? snap?.requiredSignatories ?? []).map((s) => ({
        uid: uid(),
        label: s.label,
        role: s.role ?? "",
      })),
    );
    setLoadedKey(key);
    setDirty(false);
  }, [draftVersion, latestPublished, loadedKey]);

  const proposalItems = useMemo(() => toProposalItems(items), [items]);
  const included = items.filter((i) => i.included && i.description.trim());
  const subtotal = roundCents(included.reduce((a, i) => a + gross(i), 0));
  const discounts = roundCents(included.reduce((a, i) => a + Math.min(i.discount, gross(i)), 0));
  // Só preço fixo entra no total; opcional, condicional e a definir ficam à parte.
  const total = roundCents(
    proposalItems.filter((i) => countsInDefinedTotal(i)).reduce((a, i) => a + i.total, 0),
  );
  const pricingWarnings = [
    ...included.flatMap((i) => pricingIssues(i).map((msg) => `${i.description.trim()}: ${msg}`)),
    ...conditionPendingIssues(contractRowToSnapshot(contractQuery.data)).map(
      (m) => `${m} — defina antes de apresentar como condição aceita`,
    ),
  ];
  const usedKeys = new Set(items.map((i) => i.templateKey).filter(Boolean));
  const missingTemplates = PROPOSAL_ITEM_TEMPLATES.filter((t) => !usedKeys.has(t.key));
  const excludedCount = items.filter((i) => !i.included && i.description.trim()).length;

  const draftInput = () => ({
    proposalId: draftVersion?.id ?? null,
    implementationId,
    expectedRevision: draftVersion?.draftRevision ?? null,
    items: proposalItems,
    itemOptions: toOptions(items),
    partnershipObject: partnershipObject.trim() || null,
    responsibilities: serializeResponsibilities(responsibilities),
    requiredSignatories: serializeSignatories(signatoriesList),
    commandId: crypto.randomUUID(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["commercial-proposals", implementationId] });

  const saveDraft = useMutation({
    mutationFn: () => commercialProposalsApi.saveDraft(draftInput()),
    onSuccess: async () => {
      setDirty(false);
      await invalidate();
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      const saved = await commercialProposalsApi.saveDraft(draftInput());
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

  const touch = () => setDirty(true);
  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((cur) => cur.map((i) => (i.uid === id ? { ...i, ...patch } : i)));
    touch();
  };
  const moveItem = (index: number, delta: number) => {
    setItems((cur) => {
      const next = [...cur];
      const target = index + delta;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    touch();
  };

  const draftSnapshot: CommercialProposalSnapshot = useMemo(
    () => ({
      schemaVersion: 1,
      proposalId: draftVersion?.id ?? "draft",
      implementationId,
      version: draftVersion?.version ?? (latestPublished ? latestPublished.version + 1 : 1),
      opportunity: {
        code: implementationQueryResult.data?.code ?? "",
        title: implementationQueryResult.data?.nickname ?? null,
      },
      partnershipObject: optionsSupported ? partnershipObject.trim() || null : null,
      items: proposalItems,
      total,
      commercialTerms: (commercialTerms.data ?? []).map((t) => ({
        label: t.label,
        chargeType: t.chargeType,
        value: t.value,
        optional: t.optional,
        displayOrder: t.displayOrder,
        notes: t.notes,
      })),
      contractConditions: contractRowToSnapshot(contractQuery.data),
      responsibilities: serializeResponsibilities(responsibilities),
      content: (contentQuery.data ?? []).map((b) => ({
        title: b.title,
        body: b.body,
        displayOrder: b.display_order,
      })),
      requiredSignatories: serializeSignatories(signatoriesList),
      publishedAt: new Date().toISOString(),
    }),
    [
      draftVersion,
      latestPublished,
      implementationId,
      implementationQueryResult.data,
      optionsSupported,
      partnershipObject,
      proposalItems,
      total,
      commercialTerms.data,
      contractQuery.data,
      responsibilities,
      contentQuery.data,
      signatoriesList,
    ],
  );

  if (versionsQuery.isLoading) {
    return <div className={`${card} text-sm text-muted-foreground`}>Carregando propostas…</div>;
  }
  if (versionsQuery.isError) {
    return (
      <div className={card}>
        <p className="text-sm font-medium text-destructive">{proposalError(versionsQuery.error)}</p>
        <Button className="mt-4" variant="outline" onClick={() => void versionsQuery.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const selectedVersion =
    previewId && previewId !== "draft" ? (versions.find((v) => v.id === previewId) ?? null) : null;
  const canSave = proposalItems.length > 0 && !saveDraft.isPending && !publish.isPending;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da versão */}
      <section className={card}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
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
              {latestPublished
                ? `Versão ${latestPublished.version} está ${statusLabels[latestPublished.status].toLowerCase()} e não muda. As edições abaixo formam a próxima versão.`
                : "O rascunho é interno até você publicar."}
              {dirty && " · Alterações não salvas."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewId("draft")}>
              <Eye className="mr-2 h-4 w-4" /> Ver como o proprietário
            </Button>
            <Button
              variant="outline"
              disabled={!canSave || (!dirty && Boolean(draftVersion))}
              onClick={() => saveDraft.mutate()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveDraft.isPending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button disabled={!canSave} onClick={() => setConfirmPublish(true)}>
              <Send className="mr-2 h-4 w-4" />
              {publish.isPending ? "Publicando…" : "Publicar nova versão"}
            </Button>
          </div>
        </div>
        {(saveDraft.isError || publish.isError) && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {proposalError(saveDraft.error ?? publish.error)} O que você preencheu continua na tela.
          </div>
        )}
        {saveDraft.isSuccess && !dirty && (
          <p className="mt-3 text-xs text-[var(--stayo-success)]">Rascunho salvo.</p>
        )}
      </section>

      {/* A. Condições da proposta */}
      <section className={card} aria-labelledby="area-condicoes">
        <p className={eyebrow}>A</p>
        <h3 id="area-condicoes" className="text-lg font-semibold">
          Condições da proposta
        </h3>
        <div className="mt-3 flex gap-2 rounded-lg border border-[var(--stayo-gold)] bg-[var(--stayo-gold-soft)] p-3 text-xs text-[var(--stayo-warning)]">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            A proposta comercial apresenta condições e serviços. Ela não substitui o contrato
            assinado, que é tratado à parte. O aceite do proprietário é comercial.
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="partnership-object" className="text-sm font-semibold">
              Objeto da parceria
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Em uma ou duas frases: o que a STAYO fará por este imóvel.
            </p>
            <Textarea
              id="partnership-object"
              className="mt-2 min-h-24"
              maxLength={2000}
              disabled={!optionsSupported}
              value={partnershipObject}
              placeholder="Ex.: Gestão completa da locação por temporada do apartamento, incluindo anúncios, atendimento aos hóspedes, limpeza e manutenção."
              onChange={(e) => {
                setPartnershipObject(e.target.value);
                touch();
              }}
            />
            {!optionsSupported && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Disponível depois que a atualização do banco for aprovada.
              </p>
            )}
          </div>

          {!(commercialTerms.isSuccess && (commercialTerms.data ?? []).length === 0) && (
          <div>
            <h4 className="text-sm font-semibold">Condições comerciais adicionais</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vêm da ficha (aba Resumo) e são congeladas na publicação.
            </p>
            {commercialTerms.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
            ) : commercialTerms.isError ? (
              <p className="mt-2 text-sm text-destructive">
                Não foi possível carregar. Não publique até corrigir.
              </p>
            ) : (commercialTerms.data ?? []).length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Nenhuma condição comercial cadastrada.
              </p>
            ) : (
              <dl className="mt-2 divide-y rounded-lg border">
                {(commercialTerms.data ?? []).map((t) => (
                  <div key={t.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                    <dt>{t.label}</dt>
                    <dd className="font-medium tabular-nums">
                      {t.chargeType === "percentage"
                        ? `${String(t.value).replace(".", ",")}%`
                        : formatBRL(t.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          )}
        </div>

        <div className="mt-5">
          <ImplementationDecisionsPanel implementationId={implementationId} />
        </div>

        <div className="mt-5">
          <ContractConditionsPanel
            implementationId={implementationId}
            showMeetings={false}
            cleaningItems={items
              .filter((i) => i.templateKey === "limpeza-pos-obra" || /limpeza/i.test(i.description))
              .map((i) => ({ description: i.description, total: lineTotal(i), included: i.included }))}
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold">Responsabilidades</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">Quem faz o quê, uma por linha.</p>
            <ul className="mt-2 space-y-2">
              {responsibilities.map((r) => (
                <li key={r.uid} className="grid grid-cols-[120px_minmax(0,1fr)_auto] gap-2">
                  <select
                    aria-label="Responsável"
                    value={r.party}
                    onChange={(e) => {
                      setResponsibilities((cur) =>
                        cur.map((x) =>
                          x.uid === r.uid ? { ...x, party: e.target.value as Party } : x,
                        ),
                      );
                      touch();
                    }}
                    className="h-10 rounded-md border border-input bg-white px-2 text-sm"
                  >
                    {PARTIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <Input
                    aria-label="Responsabilidade"
                    value={r.text}
                    placeholder="Ex.: Cadastro e configuração dos anúncios"
                    onChange={(e) => {
                      setResponsibilities((cur) =>
                        cur.map((x) => (x.uid === r.uid ? { ...x, text: e.target.value } : x)),
                      );
                      touch();
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Remover responsabilidade"
                    className="flex size-10 items-center justify-center rounded-md border text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setResponsibilities((cur) => cur.filter((x) => x.uid !== r.uid));
                      touch();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-2"
              variant="outline"
              size="sm"
              onClick={() => {
                setResponsibilities((cur) => [...cur, { uid: uid(), party: "STAYO", text: "" }]);
                touch();
              }}
            >
              <Plus className="mr-1.5 size-4" /> Adicionar responsabilidade
            </Button>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Partes exigidas</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Quem precisa participar do aceite comercial. Isto não cria assinatura de contrato.
            </p>
            <ul className="mt-2 space-y-2">
              {signatoriesList.map((s) => (
                <li key={s.uid} className="grid grid-cols-[minmax(0,1fr)_160px_auto] gap-2">
                  <Input
                    aria-label="Nome ou identificação"
                    value={s.label}
                    placeholder="Ex.: Maria Souza"
                    onChange={(e) => {
                      setSignatoriesList((cur) =>
                        cur.map((x) => (x.uid === s.uid ? { ...x, label: e.target.value } : x)),
                      );
                      touch();
                    }}
                  />
                  <select
                    aria-label="Papel"
                    value={s.role}
                    onChange={(e) => {
                      setSignatoriesList((cur) =>
                        cur.map((x) => (x.uid === s.uid ? { ...x, role: e.target.value } : x)),
                      );
                      touch();
                    }}
                    className="h-10 rounded-md border border-input bg-white px-2 text-sm"
                  >
                    <option value="">Papel…</option>
                    {[...new Set([...ROLES, ...(s.role ? [s.role] : [])])].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="Remover parte"
                    className="flex size-10 items-center justify-center rounded-md border text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setSignatoriesList((cur) => cur.filter((x) => x.uid !== s.uid));
                      touch();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-2"
              variant="outline"
              size="sm"
              onClick={() => {
                setSignatoriesList((cur) => [
                  ...cur,
                  { uid: uid(), label: "", role: "Proprietário titular" },
                ]);
                touch();
              }}
            >
              <Plus className="mr-1.5 size-4" /> Adicionar parte
            </Button>
          </div>
        </div>
      </section>

      {/* B. Serviços e valores */}
      <section className={card} aria-labelledby="area-servicos">
        <p className={eyebrow}>B</p>
        <h3 id="area-servicos" className="text-lg font-semibold">
          Serviços e valores da implantação
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Itens desligados não entram no total nem na versão publicada. Ligar um item não gera
          cobrança, nota ou pagamento.
        </p>

        {missingTemplates.length > 0 && (
          <div className="mt-4 rounded-lg border border-dashed p-3">
            <p className="text-xs font-semibold">Itens padrão de implantação</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Sugestões do modelo. Ao adicionar, vira uma cópia editável deste rascunho, desligada
              até você incluir.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {missingTemplates.map((t) => (
                <Button
                  key={t.key}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setItems((cur) => [...cur, fromTemplate(t)]);
                    touch();
                  }}
                >
                  <Plus className="mr-1 size-3.5" /> {t.description} · {formatBRL(t.unitValue)}
                </Button>
              ))}
              {missingTemplates.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setItems((cur) => [...cur, ...missingTemplates.map(fromTemplate)]);
                    touch();
                  }}
                >
                  Adicionar todos
                </Button>
              )}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum serviço no rascunho. Use os itens padrão ou adicione um item personalizado.
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.uid}
              className={`rounded-lg border p-3 transition-opacity ${item.included ? "" : "bg-slate-50 opacity-70"}`}
            >
              <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_70px_130px_130px_120px_auto] md:items-end">
                <label className="flex min-h-10 items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(e) => updateItem(item.uid, { included: e.target.checked })}
                    className="size-4"
                    aria-label={`Incluir ${item.description || "item"}`}
                  />
                  <span className="md:sr-only">Incluir</span>
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Nome do serviço
                  <Input
                    value={item.description}
                    placeholder="Ex.: Fotos profissionais"
                    onChange={(e) => updateItem(item.uid, { description: e.target.value })}
                    className="mt-1"
                  />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Qtd.
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.uid, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="mt-1"
                  />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Valor unitário
                  <MoneyInput
                    value={item.unitValue}
                    onValueChange={(v) => updateItem(item.uid, { unitValue: v })}
                    className="mt-1"
                  />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Desconto
                  <MoneyInput
                    value={item.discount}
                    onValueChange={(v) => updateItem(item.uid, { discount: v })}
                    className="mt-1"
                  />
                </label>
                <div className="text-[11px] font-medium text-muted-foreground">
                  Total
                  <p className="mt-1 flex h-10 items-center justify-end font-semibold tabular-nums text-foreground">
                    {!item.included
                      ? "Fora do total"
                      : resolvePricing(item) === "tbd"
                        ? "A definir"
                        : resolvePricing(item) === "fixed"
                          ? formatBRL(lineTotal(item))
                          : `${formatBRL(lineTotal(item))}*`}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    aria-label="Mover para cima"
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                    className="flex size-9 items-center justify-center rounded-md border disabled:opacity-40"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Mover para baixo"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                    className="flex size-9 items-center justify-center rounded-md border disabled:opacity-40"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remover item"
                    className="flex size-9 items-center justify-center rounded-md border text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setItems((cur) => cur.filter((x) => x.uid !== item.uid));
                      touch();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  Tipo de valor
                  <select
                    value={resolvePricing(item)}
                    onChange={(e) => {
                      const pricing = e.target.value as ItemPricing;
                      updateItem(item.uid, { pricing, optional: pricing === "optional" });
                    }}
                    className="h-8 rounded-md border bg-background px-2 text-[11px] text-foreground"
                  >
                    {(Object.keys(PRICING_LABELS) as ItemPricing[]).map((k) => (
                      <option key={k} value={k}>
                        {PRICING_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                {item.included &&
                  pricingIssues(item).map((msg) => (
                    <span key={msg} className="text-[var(--stayo-warning)]">
                      {msg}
                    </span>
                  ))}
                {item.templateKey && <span>Cópia do modelo — editar aqui não muda o modelo.</span>}
                {item.discount > gross(item) && (
                  <span className="text-[var(--stayo-warning)]">
                    Desconto maior que o valor; o total fica em {formatBRL(0)}.
                  </span>
                )}
              </div>
              {item.included ? (
                <ItemScopeEditor item={item} onChange={(patch) => updateItem(item.uid, patch)} />
              ) : (
                (item.details || (item.scope?.length ?? 0) > 0) && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Desligado · descrição e {item.scope?.length ?? 0} subitem(ns) guardados no
                    rascunho.
                  </p>
                )
              )}
            </li>
          ))}
        </ul>

        <Button
          className="mt-3"
          variant="outline"
          size="sm"
          onClick={() => {
            setItems((cur) => [...cur, newItem()]);
            touch();
          }}
        >
          <Plus className="mr-1.5 size-4" /> Adicionar item personalizado
        </Button>

        {excludedCount > 0 && !optionsSupported && (
          <p className="mt-3 rounded-lg bg-[var(--stayo-gold-soft)] p-3 text-xs text-[var(--stayo-warning)]">
            {excludedCount} item(ns) desligado(s). Até a atualização do banco ser aprovada, itens
            desligados não ficam guardados no rascunho ao salvar.
          </p>
        )}

        <dl className="mt-4 ml-auto max-w-sm space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatBRL(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Descontos</dt>
            <dd className="tabular-nums">
              {discounts > 0 ? `− ${formatBRL(discounts)}` : formatBRL(0)}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total definido (só preço fixo)</dt>
            <dd className="tabular-nums">{formatBRL(total)}</dd>
          </div>
        </dl>
      </section>

      {(previewId === "draft" || selectedVersion?.snapshot) && (
        <section
          className="rounded-[var(--radius-card)] border-2 bg-white p-4 sm:p-5"
          style={{ borderColor: "var(--stayo-forest)" }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className={eyebrow}>Prévia interna · exatamente o que o proprietário verá</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {previewId === "draft"
                  ? "Rascunho atual, ainda não publicado. As condições da ficha são congeladas no momento da publicação."
                  : `Versão ${selectedVersion?.version} publicada — imutável.`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreviewId(null)}>
              Fechar
            </Button>
          </div>
          <ProposalPresentationView
            snapshot={previewId === "draft" ? draftSnapshot : selectedVersion!.snapshot!}
          />
        </section>
      )}

      <section className={card}>
        <div className="mb-4">
          <h3 className="font-semibold">Histórico de versões</h3>
          <p className="text-sm text-muted-foreground">
            Versões publicadas e aceitas permanecem imutáveis. Uma nova negociação gera outra
            versão.
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
                    <span className="rounded-full bg-[var(--stayo-bg-soft)] px-2 py-0.5 text-xs font-medium">
                      {statusLabels[version.status]}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatBRL(version.total)}
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
                  {version.snapshot && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setPreviewId(version.id)}>
                        <Eye className="mr-2 h-4 w-4" /> Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pdf.isPending}
                        onClick={() => pdf.mutate(version)}
                      >
                        <FileText className="mr-2 h-4 w-4" /> PDF
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar versão {draftSnapshot.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              {proposalItems.length} serviço(s) incluído(s), total {formatBRL(total)}. Depois de
              publicada, esta versão não pode ser alterada
              {latestPublished?.status === "published"
                ? ` e a versão ${latestPublished.version} passa a ser substituída`
                : ""}
              . Nenhuma cobrança é emitida ao publicar.
              {pricingWarnings.length > 0 && (
                <span className="mt-3 block rounded-md bg-[var(--stayo-gold-soft)] p-2 text-xs text-[var(--stayo-warning)]">
                  Revise antes de publicar: {pricingWarnings.join(" ")}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => publish.mutate()}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemScopeEditor({
  item,
  onChange,
}: {
  item: DraftItem;
  onChange: (patch: Partial<DraftItem>) => void;
}) {
  const scope = item.scope ?? [];
  const setScope = (next: string[]) => onChange({ scope: next });
  const swap = (a: number, b: number) => {
    const n = [...scope];
    [n[a], n[b]] = [n[b]!, n[a]!];
    setScope(n);
  };
  return (
    <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-2">
      <label className="text-[11px] font-medium text-muted-foreground">
        Descrição do serviço
        <Textarea
          className="mt-1 min-h-20"
          maxLength={1000}
          value={item.details ?? ""}
          placeholder="O que está incluído. Se algo depende de fornecedor, material, aprovação ou preço à parte, diga aqui."
          onChange={(e) => onChange({ details: e.target.value })}
        />
      </label>
      <div>
        <p className="text-[11px] font-medium text-muted-foreground">
          Escopo (subitens) · descrevem o serviço, não são cobranças extras
        </p>
        <ul className="mt-1 space-y-1.5">
          {scope.map((entry, i) => (
            <li key={i} className="flex gap-1">
              <Input
                aria-label={`Subitem ${i + 1}`}
                value={entry}
                maxLength={200}
                onChange={(e) => setScope(scope.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-9"
              />
              <button
                type="button"
                aria-label="Subir subitem"
                disabled={i === 0}
                onClick={() => swap(i, i - 1)}
                className="flex size-9 shrink-0 items-center justify-center rounded-md border disabled:opacity-40"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Descer subitem"
                disabled={i === scope.length - 1}
                onClick={() => swap(i, i + 1)}
                className="flex size-9 shrink-0 items-center justify-center rounded-md border disabled:opacity-40"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Remover subitem"
                onClick={() => setScope(scope.filter((_, j) => j !== i))}
                className="flex size-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <Button
          className="mt-1.5"
          variant="ghost"
          size="sm"
          disabled={scope.length >= 30}
          onClick={() => setScope([...scope, ""])}
        >
          <Plus className="mr-1 size-3.5" /> Adicionar subitem
        </Button>
      </div>
    </div>
  );
}
