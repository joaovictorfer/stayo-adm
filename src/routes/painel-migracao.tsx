import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { AdminPageHeader, AdminSection, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth/session";
import { consolidateFunctions, exportableFunctions } from "@/lib/migration/complements";
import { readMigrationComplements } from "@/lib/migration/complements.functions";

const sources = import.meta.glob<string>('/supabase/functions/*/index.ts', { query: '?raw', import: 'default', eager: true });
const functions = exportableFunctions(sources);
const title = "Painel de Migração — STAYO Admin";
const description = "Complementos do EXPORT: código de funções, nomes de secrets e conferência de integrações externas.";

export const Route = createFileRoute("/painel-migracao")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: MigrationPanel,
});

function MigrationPanel() {
  const auth = useAuthSession();
  const read = useServerFn(readMigrationComplements);
  const load = useMutation({ mutationFn: () => read() });
  if (auth.status !== "authenticated") return <AdminSection title="Acesso restrito"><p>Entre com uma conta administrativa para acessar os complementos.</p></AdminSection>;
  if (auth.profile?.role !== "super_admin" && auth.profile?.role !== "admin") return <AdminSection title="Acesso restrito"><p>Somente administradores podem acessar este painel.</p></AdminSection>;
  function downloadFunctions() {
    if (!functions.length) return;
    const url = URL.createObjectURL(new Blob([consolidateFunctions(sources)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "edge-functions.ts"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-6">
    <AdminPageHeader eyebrow="Configurações · Transferência" title="Painel de Migração" description="Baixe os complementos e anexe na extensão CloneSupa. O banco será importado pelo arquivo EXPORT (.backup)." actions={<Button onClick={() => load.mutate()} disabled={load.isPending}>{load.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}{load.isPending ? "Carregando…" : load.isError ? "Tentar novamente" : "Carregar complementos"}</Button>} />
    {load.isError && <p role="alert" className="text-destructive">Não foi possível carregar os complementos. Verifique seu acesso e tente novamente.</p>}
    <AdminSection title="Passo 1 — Edge Functions" action={<AdminStatusBadge>{functions.length} funções exportáveis</AdminStatusBadge>}>
      {functions.length ? <ul className="divide-y divide-border">{functions.map((entry) => <li className="py-3" key={entry.name}><strong>{entry.name}</strong>{entry.localImports.length > 0 && <p className="text-sm text-muted-foreground break-words">Arquivos auxiliares necessários no repositório: {entry.localImports.join(", ")}</p>}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma Edge Function para exportar</p>}
      <p className="my-4 text-sm text-muted-foreground">Este Admin utiliza funções integradas ao aplicativo. Elas não são Edge Functions e precisam acompanhar o código do aplicativo na transferência; o EXPORT não as substitui.</p>
      <Button variant="outline" onClick={downloadFunctions} disabled={!functions.length}><Download />Baixar edge-functions.ts</Button>
    </AdminSection>
    <AdminSection title="Passo 2 — Secrets personalizados" action={<ShieldCheck className="size-5 text-muted-foreground" />}>
      <p className="mb-4 text-sm text-muted-foreground">Por segurança, este painel confere apenas nomes. Valores não são revelados, copiados nem exportados. Configure as chaves novamente no destino a partir de seus provedores; credenciais do banco de origem nunca fazem parte dos complementos.</p>
      {load.isPending ? <p role="status">Carregando nomes…</p> : load.isError ? <p>Conferência indisponível — tente novamente.</p> : load.data ? load.data.secretNames.length ? <ul className="divide-y divide-border">{load.data.secretNames.map((name) => <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={name}><code className="break-all text-sm">{name}</code><AdminStatusBadge>Nome identificado</AdminStatusBadge></li>)}</ul> : <p>Nenhum secret personalizado identificado neste ambiente.</p> : <p className="text-sm text-muted-foreground">Carregue os complementos para conferir os nomes disponíveis neste ambiente.</p>}
      <p className="mt-4 text-xs text-muted-foreground">A lista reflete as variáveis disponíveis no ambiente atual, não certifica outros ambientes. Secrets gerenciados pela plataforma são excluídos.</p>
    </AdminSection>
    <AdminSection title="Passo 3 — Conferência dos complementos">
      <div className="mb-4 flex flex-wrap gap-3"><AdminStatusBadge>{functions.length} Edge Functions</AdminStatusBadge><AdminStatusBadge>{load.isSuccess ? `${load.data.secrets_count} nomes de secrets personalizados` : "Secrets: conferência pendente"}</AdminStatusBadge></div>
      <div className="space-y-4 text-sm">
        <p>Na extensão CloneSupa, anexe o .backup em Arquivo EXPORT do Lovable e, quando disponível, edge-functions.ts em Executar a clonagem. Se não houver um complemento, desmarque a opção correspondente. Este painel não gera secrets.ts.</p>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>API Central STAYO: revisar autorização, endereço do serviço e agendamento da sincronização de reservas.</li>
          <li>Pagar.me: reconfigurar chaves e URLs de retorno/notificações conforme as configurações existentes.</li>
          <li>VF Financeiro: reconfigurar a credencial compartilhada e os endpoints /api/public/stayo-expenses e /api/public/stayo-statements.</li>
          <li>Autenticação: revisar URLs de redirecionamento e recuperação de senha no destino. OAuth e SMTP não foram conferidos no serviço hospedado por este painel.</li>
          <li>Os arquivos binários do Storage precisam ser transferidos separadamente; o EXPORT contém os metadados.</li>
          <li>Após a migração, remova esta página e sua função temporária de conferência.</li>
        </ul>
        <p className="text-muted-foreground">Schema, tabelas, dados, usuários, políticas e metadados são responsabilidade exclusiva do EXPORT. Este painel não consulta nem exporta esses itens e não altera o sistema antigo.</p>
      </div>
    </AdminSection>
  </div>;
}