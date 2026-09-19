import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Copy, ExternalLink, Link2, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { adminApi, ownerOnboardingLinkQuery, ownerQuery, ownerTasksQuery, proposalsByImplementationQuery } from "../../lib/api/queries";
import { computeProgress } from "../../lib/implementation-status";
import type { ImplementationItem, ImplementationProject } from "../../types/core";
import { ownerOnboardingLinkStatus } from "../../types/owner-onboarding";
import type { OwnerPortalSnapshot } from "../../types/owner-portal";
import { Button } from "../ui/button";
import { Drawer } from "../patterns/Drawer";

const tokenKey = (implementationId: string) => `stayo-admin:portal-token:${implementationId}`;

function readSessionToken(implementationId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(tokenKey(implementationId));
}

export function OwnerPortalAccess({
  open,
  onClose,
  implementation,
  checklist,
}: {
  open: boolean;
  onClose: () => void;
  implementation: ImplementationProject;
  checklist: ImplementationItem[];
}) {
  const queryClient = useQueryClient();
  const linkQ = useQuery(ownerOnboardingLinkQuery(implementation.id));
  const tasksQ = useQuery({
    ...ownerTasksQuery(implementation.ownerId ?? ""),
    enabled: Boolean(implementation.ownerId),
  });
  const proposalsQ = useQuery(proposalsByImplementationQuery(implementation.id));
  const ownerQ = useQuery({ ...ownerQuery(implementation.ownerId ?? ""), enabled: Boolean(implementation.ownerId) });
  const [token, setToken] = useState<string | null>(() => readSessionToken(implementation.id));
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => setToken(readSessionToken(implementation.id)), [implementation.id]);

  const snapshot = useMemo<OwnerPortalSnapshot>(() => {
    const visible = checklist.filter((item) => item.ownerVisible);
    const progress = computeProgress(visible);
    const proposal = proposalsQ.data?.[0] ?? null;
    const propertyLabel = [implementation.condominiumName, implementation.unit]
      .filter(Boolean)
      .join(" ") || implementation.nickname || "Seu imóvel";
    return {
      mode: "implementation",
      ownerFirstName: implementation.ownerName?.trim().split(/\s+/)[0] || "proprietário",
      ownerName: implementation.ownerName,
      ownerPhone: implementation.ownerPhone,
      ownerEmail: ownerQ.data?.email ?? null,
      propertyLabel,
      status: implementation.status,
      startDateEstimate: implementation.startDateEstimate,
      completionDateEstimate: implementation.completionDateEstimate,
      visibleProgress: progress,
      tasks: [
        ...(tasksQ.data ?? [])
          .filter((task) => !task.implementationId || task.implementationId === implementation.id)
          .map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            source: "owner_task" as const,
          })),
        ...visible
          .filter((item) => item.status !== "concluido" && item.status !== "nao_aplicavel")
          .map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            status: item.status,
            source: "checklist" as const,
          })),
      ],
      updates: visible
        .filter((item): item is ImplementationItem & { completedAt: string } => Boolean(item.completedAt))
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
        .map((item) => ({ id: item.id, title: item.title, completedAt: item.completedAt })),
      proposal: proposal
        ? {
            id: proposal.id,
            version: proposal.version,
            total: proposal.total,
            acceptedAt: proposal.acceptedAt,
            acceptedName: proposal.acceptedName,
            items: proposal.items,
          }
        : null,
      refreshedAt: new Date().toISOString(),
    };
  }, [checklist, implementation, ownerQ.data, proposalsQ.data, tasksQ.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["owner-onboarding", "link", implementation.id] });

  const create = useMutation({
    mutationFn: () => adminApi.ownerOnboarding.createLink(implementation.id, implementation.ownerId, snapshot, 30),
    onSuccess: async ({ token: createdToken }) => {
      window.sessionStorage.setItem(tokenKey(implementation.id), createdToken);
      setToken(createdToken);
      setFeedback("Acesso criado. O link ficará disponível nesta sessão.");
      await invalidate();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.ownerOnboarding.revoke(id),
    onSuccess: async () => {
      window.sessionStorage.removeItem(tokenKey(implementation.id));
      setToken(null);
      setFeedback("Acesso revogado.");
      await invalidate();
    },
  });

  const link = linkQ.data;
  const status = link ? ownerOnboardingLinkStatus(link) : null;
  const active = status === "ativo";
  const url = token ? `${window.location.origin}/portal/implantacao/${token}` : null;

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setFeedback("Link copiado.");
  };
  const share = async () => {
    if (!url) return;
    if (navigator.share) {
      await navigator.share({ title: "Portal do Proprietário Stayo", text: "Acompanhe a implantação do seu imóvel.", url });
      setFeedback("Compartilhamento aberto.");
    } else {
      await copy();
    }
  };

  return (
    <Drawer open={open} onClose={onClose} eyebrow="Modo implantação" title="Portal do proprietário">
      <div className="space-y-5">
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`} />
            <p className="font-semibold text-foreground">
              {active ? "Acesso ativo" : link ? "Sem acesso ativo" : "Acesso ainda não criado"}
            </p>
          </div>
          {link ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Criado em {new Date(link.createdAt).toLocaleString("pt-BR")} · expira em {new Date(link.expiresAt).toLocaleDateString("pt-BR")}
            </p>
          ) : null}
        </div>

        {active && !url ? (
          <p className="rounded-md border border-premium/40 bg-premium/10 p-3 text-sm text-foreground">
            O segredo deste acesso não é recuperável. Gere um novo link para copiar ou compartilhar; o anterior será invalidado.
          </p>
        ) : null}

        {url ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground">Link seguro</label>
            <code className="block break-all rounded-md border border-border bg-background p-3 text-xs text-foreground">{url}</code>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink /> Abrir portal</Button>
              <Button variant="outline" onClick={() => void copy()}><Copy /> Copiar link</Button>
              <Button variant="outline" onClick={() => void share()}><Share2 /> Compartilhar</Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {!active ? (
            <Button onClick={() => create.mutate()} disabled={create.isPending || !implementation.ownerId}>
              <Link2 /> {create.isPending ? "Criando..." : "Criar acesso"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => create.mutate()} disabled={create.isPending}>
                <RefreshCw /> {create.isPending ? "Gerando..." : "Gerar novo link"}
              </Button>
              {link ? <Button variant="destructive" onClick={() => revoke.mutate(link.id)} disabled={revoke.isPending}><Ban /> {revoke.isPending ? "Revogando..." : "Revogar acesso"}</Button> : null}
            </>
          )}
        </div>

        {!implementation.ownerId ? <p className="text-sm text-destructive">Vincule um proprietário antes de criar o acesso.</p> : null}
        {feedback ? <p role="status" className="flex items-center gap-2 text-sm text-success"><Check size={15} /> {feedback}</p> : null}
        {(create.isError || revoke.isError) ? <p role="alert" className="text-sm text-destructive">Não foi possível concluir. Tente novamente.</p> : null}
      </div>
    </Drawer>
  );
}