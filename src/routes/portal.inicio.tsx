import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { getAttachmentSignedUrl, listOwnerAttachments } from "../lib/api/attachments";
import { ownerQuery, ownerTasksQuery } from "../lib/api/queries";
import { isSupabaseConfigured, ownerSignOut, useOwnerSession } from "../lib/auth/owner-session";
import type { OwnerTaskStatus } from "../types/admin";

export const Route = createFileRoute("/portal/inicio")({
  head: () => ({
    meta: [{ title: "Minha conta — Portal do Proprietário Stayo" }],
  }),
  component: OwnerHomePage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const ownerTaskKindLabels: Record<string, string> = {
  banking_data: "Dado bancário",
  wifi_info: "Wi-Fi",
  regulation_document: "Documento de regularização",
  custom: "Outro",
};

const ownerTaskStatusLabels: Record<OwnerTaskStatus, string> = {
  pending: "Pendente",
  done: "Resolvida",
  dismissed: "Dispensada",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center"
      style={{
        backgroundColor: "var(--stayo-bg)",
        color: "var(--stayo-ink)",
        fontFamily: "var(--stayo-font-ui)",
      }}
    >
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-sm"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            S
          </span>
          <span className="text-base" style={{ fontFamily: "var(--stayo-font-display)" }}>
            Stayo
          </span>
        </div>
        <div className="rounded-[var(--radius-card)] border p-6" style={surface}>
          {children}
        </div>
      </div>
    </div>
  );
}

function OwnerHomePage() {
  const navigate = useNavigate();
  const auth = useOwnerSession();

  useEffect(() => {
    if (auth.status === "unauthenticated" || auth.status === "not_required") {
      void navigate({ to: "/portal/login" });
    }
  }, [auth.status, navigate]);

  const signOut = useMutation({
    mutationFn: () => ownerSignOut(),
    onSuccess: () => void navigate({ to: "/portal/login" }),
  });

  if (!isSupabaseConfigured() || auth.status === "loading") {
    return (
      <Shell>
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      </Shell>
    );
  }

  if (auth.status !== "authenticated" || !auth.account) {
    return (
      <Shell>
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Redirecionando para o login...
        </p>
      </Shell>
    );
  }

  return <OwnerHomeContent ownerId={auth.account.ownerId} onSignOut={() => signOut.mutate()} />;
}

function OwnerHomeContent({ ownerId, onSignOut }: { ownerId: string; onSignOut: () => void }) {
  const ownerQ = useQuery(ownerQuery(ownerId));
  const tasksQ = useQuery(ownerTasksQuery(ownerId));
  const attachmentsQ = useQuery({
    queryKey: ["owner-attachments", ownerId],
    queryFn: () => listOwnerAttachments(ownerId),
  });
  const download = useMutation({
    mutationFn: (storagePath: string) => getAttachmentSignedUrl(storagePath),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
  });
  const pending = (tasksQ.data ?? []).filter((t) => t.status === "pending");

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
            Olá, {ownerQ.data?.name ?? "..."}
          </h1>
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Acompanhe a implantação do seu imóvel.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="text-xs underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Sair
        </button>
      </div>

      <h2 className="mb-2 text-sm" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Precisamos de você
      </h2>
      {tasksQ.isPending ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      ) : pending.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhuma pendência no momento — tudo certo por aqui.
        </p>
      ) : (
        <ul className="divide-y text-sm" style={{ borderColor: "var(--stayo-border)" }}>
          {pending.map((task) => (
            <li key={task.id} className="py-2">
              <p>{task.title}</p>
              <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {ownerTaskKindLabels[task.kind] ?? task.kind} · {ownerTaskStatusLabels[task.status]}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 mb-2 text-sm" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Seus documentos
      </h2>
      {attachmentsQ.isPending ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      ) : (attachmentsQ.data ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhum documento por aqui ainda.
        </p>
      ) : (
        <ul className="divide-y text-sm" style={{ borderColor: "var(--stayo-border)" }}>
          {(attachmentsQ.data ?? []).map((att) => (
            <li key={att.id} className="flex items-center justify-between py-2">
              <span>{att.filename}</span>
              <button
                type="button"
                onClick={() => download.mutate(att.storagePath)}
                className="text-xs underline"
                style={{ color: "var(--stayo-forest)" }}
              >
                Baixar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
