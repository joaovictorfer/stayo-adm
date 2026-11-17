import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Link2, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { createStaffLink, opStaffQuery, revokeStaffLinks, saveStaff, setStaffActive } from "@/lib/api/op-execution";

export const Route = createFileRoute("/operacao/equipe")({
  head: () => ({ meta: [
    { title: "Equipe e Meu Dia — Stayo Admin" },
    { name: "description", content: "Equipe operacional e links Meu Dia para execução das tarefas." },
    { property: "og:title", content: "Equipe e Meu Dia — Stayo Admin" },
    { property: "og:description", content: "Equipe operacional e links Meu Dia da Stayo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: EquipePage,
});

function EquipePage() {
  const qc = useQueryClient();
  const staff = useQuery(opStaffQuery());
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [lastLink, setLastLink] = useState<{ id: string; url: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["op-staff"] });
  const onErr = (e: Error) => toast.error(e.message);
  const add = useMutation({ mutationFn: () => saveStaff({ name, phone }), onSuccess: () => { setName(""); setPhone(""); toast.success("Pessoa adicionada"); void refresh(); }, onError: onErr });
  const link = useMutation({ mutationFn: createStaffLink, onSuccess: async (url, id) => { setLastLink({ id, url }); try { await navigator.clipboard.writeText(url); toast.success("Link gerado e copiado"); } catch { toast.success("Link gerado"); } void refresh(); }, onError: onErr });
  const revoke = useMutation({ mutationFn: revokeStaffLinks, onSuccess: () => { setLastLink(null); toast.success("Link revogado"); void refresh(); }, onError: onErr });
  const active = useMutation({ mutationFn: ({ id, v }: { id: string; v: boolean }) => setStaffActive(id, v), onSuccess: () => void refresh(), onError: onErr });
  const input = "admin-input h-10 rounded-md border border-input bg-background px-3 text-sm";

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Equipe e Meu Dia" description="Cadastre quem executa as tarefas e envie a cada pessoa o link Meu Dia, onde ela inicia, marca o checklist, tira fotos e conclui." />
    <form className="admin-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto]" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
      <input aria-label="Nome" required className={input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <input aria-label="Telefone" className={input} placeholder="Telefone (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Button type="submit" disabled={add.isPending}><Plus className="size-4" />Adicionar</Button>
    </form>
    {staff.isPending ? <div className="admin-panel p-5 text-sm text-[var(--admin-muted)]">Carregando equipe…</div>
      : staff.isError ? <div className="admin-panel"><AdminEmptyState title="Equipe indisponível" description="Não foi possível carregar a equipe." /></div>
      : !staff.data.length ? <div className="admin-panel"><AdminEmptyState icon={Users} title="Nenhuma pessoa cadastrada" description="Adicione a primeira pessoa da equipe." /></div>
      : <div className="admin-panel divide-y divide-[var(--admin-border)]">{staff.data.map((s) => <div key={s.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><b className="text-sm">{s.name}</b>
              <AdminStatusBadge tone={s.active ? "success" : "neutral"}>{s.active ? "Ativo" : "Inativo"}</AdminStatusBadge>
              <AdminStatusBadge tone={s.linkExpiresAt ? "info" : "neutral"}>{s.linkExpiresAt ? `Link até ${new Date(s.linkExpiresAt).toLocaleDateString("pt-BR")}` : "Sem link"}</AdminStatusBadge></div>
            {s.phone && <small className="text-[var(--admin-muted)]">{s.phone}</small>}
            {lastLink?.id === s.id && <div className="mt-2 flex items-center gap-2"><code className="min-w-0 truncate rounded bg-muted px-2 py-1 text-xs">{lastLink.url}</code>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(lastLink.url).then(() => toast.success("Copiado"))}><Copy className="size-4" /></Button></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {s.active && <Button size="sm" variant="outline" disabled={link.isPending} onClick={() => link.mutate(s.id)}><Link2 className="size-4" />{s.linkExpiresAt ? "Gerar novo link" : "Gerar link"}</Button>}
            {s.linkExpiresAt && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>Revogar link</Button>}
            <Button size="sm" variant="ghost" onClick={() => active.mutate({ id: s.id, v: !s.active })}>{s.active ? "Desativar" : "Reativar"}</Button>
          </div>
        </div>)}</div>}
    <p className="text-xs text-[var(--admin-muted)]">O link é exibido só no momento em que é gerado. Gerar um novo invalida o anterior. Por segurança, o link vale 180 dias.</p>
  </div>;
}
