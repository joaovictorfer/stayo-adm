import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FileText,
  LogOut,
  Download,
  CheckCircle2,
  ClipboardList,
  Key,
  User,
  FileSignature,
} from "lucide-react";
import { useEffect } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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

const StyleInjection = () => (
  <style>{`
    .stayo-tab {
      color: var(--stayo-ink-muted);
      border-bottom: 2px solid transparent;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 0 !important;
      padding: 0.5rem 0.25rem 0.75rem 0.25rem;
      font-weight: 500;
      white-space: nowrap;
      background: transparent !important;
      box-shadow: none !important;
    }
    .stayo-tab:hover {
      color: var(--stayo-ink);
    }
    .stayo-tab[data-state="active"] {
      color: var(--stayo-forest) !important;
      border-bottom-color: var(--stayo-forest) !important;
    }
    .hide-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .tab-content-anim {
      animation: tabFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
    }
    @keyframes tabFadeIn {
      0% { opacity: 0; transform: translateY(6px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `}</style>
);

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
    <>
      <StyleInjection />
      <div
        className="min-h-screen px-4 py-6 sm:px-6 sm:py-10"
        style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-ink)", fontFamily: "var(--stayo-font-ui)" }}
      >
        <div className="mx-auto w-full max-w-3xl">
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
    </>
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
  const firstName = ownerQ.data?.name?.split(" ")[0] ?? "proprietário";

  return (
    <div className="space-y-2">
      <header className="flex items-start justify-between gap-4 pb-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em]"
             style={{ color: "var(--stayo-forest)" }}
          >
            Área do proprietário
          </p>
          <h1 className="text-2xl leading-tight sm:text-3xl" style={{ fontFamily: "var(--stayo-font-display)" }}>
            Olá, {firstName}
          </h1>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: "var(--stayo-ink-muted)" }}>
            Acompanhe com tranquilidade cada detalhe da sua implantação.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98]"
          style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
          aria-label="Sair da conta"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </header>

      <Tabs defaultValue="visao-geral" className="mt-4 w-full">
        <div className="mb-6 w-full border-b" style={{ borderColor: "var(--stayo-border)" }}>
          <TabsList className="hide-scrollbar flex h-auto w-full justify-start gap-4 overflow-x-auto overflow-y-hidden bg-transparent p-0 sm:gap-6">
            <TabsTrigger value="visao-geral" className="stayo-tab">
              Visão geral
            </TabsTrigger>
            <TabsTrigger value="implantacao" className="stayo-tab">
              Minha implantação
            </TabsTrigger>
            <TabsTrigger value="dados" className="stayo-tab">
              Meus dados
            </TabsTrigger>
            <TabsTrigger value="proposta" className="stayo-tab">
              Proposta
            </TabsTrigger>
            <TabsTrigger value="documentos" className="stayo-tab">
              Documentos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visao-geral" className="tab-content-anim space-y-6">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                   style={{ backgroundColor: "rgba(47, 91, 70, 0.1)", color: "var(--stayo-forest)" }}
              >
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Precisamos de você</h2>
                <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  Tarefas essenciais para o andamento do seu projeto.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border p-4 sm:p-5"
                 style={{ ...surface, boxShadow: "0 8px 24px rgba(32,48,40,0.04)" }}
            >
              {tasksQ.isPending ? (
                <LoadingBlock />
              ) : pending.length === 0 ? (
                <div className="flex items-center gap-3 py-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--stayo-success)" }} />
                  <p className="text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>
                    Está tudo em dia por aqui. Avisaremos caso surja alguma novidade.
                  </p>
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                  {pending.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-4 py-4 first:pt-1 last:pb-1">
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                          {ownerTaskKindLabels[task.kind] ?? task.kind} · {ownerTaskStatusLabels[task.status]}
                        </p>
                      </div>
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--stayo-warning)" }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="implantacao" className="tab-content-anim space-y-6">
          <div className="rounded-2xl border p-6 sm:p-8" style={{ ...surface, boxShadow: "0 8px 24px rgba(32,48,40,0.04)" }}>
            <div className="flex flex-col items-center justify-center py-6 text-center sm:py-10">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                   style={{ backgroundColor: "rgba(47, 91, 70, 0.06)", color: "var(--stayo-forest)" }}
              >
                <Key className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: "var(--stayo-ink)" }}>
                Preparo do móvel
              </h3>
              <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Seu projeto está em fase de estruturação. Em breve, os marcos e checklists de implantação estarão disponíveis para acompanhamento aqui.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dados" className="tab-content-anim space-y-6">
          <div className="rounded-2xl border p-6 sm:p-8" style={{ ...surface, boxShadow: "0 8px 24px rgba(32,48,40,0.04)" }}>
             <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full"
                     style={{ backgroundColor: "rgba(47, 91, 70, 0.1)", color: "var(--stayo-forest)" }}
                >
                  <User className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--stayo-ink)" }}>Seus dados</h3>
                  <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Informações cadastrais e de conta.</p>
                </div>
             </div>
             
             <dl className="grid gap-6 sm:grid-cols-2">
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   Nome completo
                 </dt>
                 <dd className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                   {ownerQ.data?.name || "Não informado"}
                 </dd>
               </div>
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   E-mail
                 </dt>
                 <dd className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                   {ownerQ.data?.email || "Não informado"}
                 </dd>
               </div>
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   Telefone
                 </dt>
                 <dd className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                   {ownerQ.data?.phone || "Não informado"}
                 </dd>
               </div>
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   Documento principal
                 </dt>
                 <dd className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                   {ownerQ.data?.document || "Não informado"}
                 </dd>
               </div>
             </dl>
          </div>
        </TabsContent>

        <TabsContent value="proposta" className="tab-content-anim space-y-6">
          <div className="rounded-2xl border p-6 sm:p-8" style={{ ...surface, boxShadow: "0 8px 24px rgba(32,48,40,0.04)" }}>
            <div className="flex flex-col items-center justify-center py-6 text-center sm:py-10">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                   style={{ backgroundColor: "rgba(47, 91, 70, 0.06)", color: "var(--stayo-forest)" }}
              >
                <FileSignature className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: "var(--stayo-ink)" }}>
                Propostas e Condições
              </h3>
              <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhuma proposta comercial recente está pendente de assinatura associada ao seu perfil no momento.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="tab-content-anim space-y-6">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                   style={{ backgroundColor: "rgba(47, 91, 70, 0.1)", color: "var(--stayo-forest)" }}
              >
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Seus documentos</h2>
                <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  Arquivos importantes reunidos em um só lugar.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border p-4 sm:p-5"
                 style={{ ...surface, boxShadow: "0 8px 24px rgba(32,48,40,0.04)" }}
            >
              {attachmentsQ.isPending ? (
                <LoadingBlock />
              ) : (attachmentsQ.data ?? []).length === 0 ? (
                <div className="py-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                  Seus documentos aparecerão aqui quando estiverem disponíveis.
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                  {(attachmentsQ.data ?? []).map((att) => (
                    <li key={att.id} className="flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
