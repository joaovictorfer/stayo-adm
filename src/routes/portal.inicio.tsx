import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, LogOut, Download, CheckCircle2, ClipboardList } from "lucide-react";
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

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold shadow-sm"
        style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
      >
        S
      </span>
      <div>
        <span className="block text-lg tracking-tight" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Stayo
        </span>
        <span className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--stayo-ink-muted)" }}>
          Portal do proprietário
        </span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-10"
      style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-ink)", fontFamily: "var(--stayo-font-ui)" }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 px-1 sm:mb-8">
          <Brand />
        </div>
        <main className="rounded-3xl border p-5 shadow-[0_20px_60px_rgba(32,48,40,0.06)] sm:p-8" style={surface}>
          {children}
        </main>
        <p className="mt-6 text-center text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Um espaço simples para acompanhar cada etapa do seu imóvel.
        </p>
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-3" aria-label="Carregando">
      <div className="h-4 w-2/3 animate-pulse rounded-full bg-black/[0.07]" />
      <div className="h-3 w-full animate-pulse rounded-full bg-black/[0.05]" />
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/[0.05]" />
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
        <LoadingBlock />
      </Shell>
    );
  }

  if (auth.status !== "authenticated" || !auth.account) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-4 h-10 w-10 animate-pulse rounded-full" style={{ backgroundColor: "var(--stayo-border)" }} />
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Estamos preparando seu espaço...
          </p>
        </div>
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
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--stayo-border)" }}>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--stayo-forest)" }}>
            Visão geral
          </p>
          <h1 className="text-2xl leading-tight sm:text-3xl" style={{ fontFamily: "var(--stayo-font-display)" }}>
            Olá, {ownerQ.data?.name ?? "proprietário"}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>
            Acompanhe com tranquilidade cada etapa da implantação do seu imóvel.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          disabled={false}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98]"
          style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
          aria-label="Sair da conta"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </header>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(47, 91, 70, 0.1)", color: "var(--stayo-forest)" }}>
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Precisamos de você</h2>
            <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Pequenos passos que ajudam tudo a avançar.</p>
          </div>
        </div>
        <div className="rounded-2xl border p-4 sm:p-5" style={{ ...surface, boxShadow: "0 8px 24px rgba(32,48,40,0.04)" }}>
          {tasksQ.isPending ? <LoadingBlock /> : pending.length === 0 ? (
            <div className="flex items-center gap-3 py-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--stayo-success)" }} />
              <p className="text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>
                Está tudo em dia por aqui. Avisaremos caso surja alguma novidade.
              </p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
              {pending.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      {ownerTaskKindLabels[task.kind] ?? task.kind} · {ownerTaskStatusLabels[task.status]}
                    </p>
                  </div>
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--stayo-warning)" }} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(47, 91, 70, 0.1)", color: "var(--stayo-forest)" }}>
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Seus documentos</h2>
            <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Arquivos importantes reunidos em um só lugar.</p>
          </div>
        </div>
        <div className="rounded-2xl border p-4 sm:p-5" style={{ ...surface, boxShadow: "0 8px 24px rgba(32,48,40,0.04)" }}>
          {attachmentsQ.isPending ? <LoadingBlock /> : (attachmentsQ.data ?? []).length === 0 ? (
            <div className="py-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              Seus documentos aparecerão aqui quando estiverem disponíveis.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
              {(attachmentsQ.data ?? []).map((att) => (
                <li key={att.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 truncate text-sm font-medium">{att.filename}</span>
                  <button
                    type="button"
                    onClick={() => download.mutate(att.storagePath)}
                    disabled={download.isPending}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 active:scale-[0.97] disabled:opacity-50"
                    style={{ color: "var(--stayo-forest)" }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
