import type { ComponentType } from "react";

import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";

export interface DemoRow { title: string; detail: string; badge: string }

/** Tela demonstrativa de configuração: nada grava. A fonte oficial é o Core, com permissão e auditoria. */
export function SettingsDemo({ title, description, icon: Icon, rows }: {
  title: string; description: string; icon: ComponentType<{ className?: string }>; rows: DemoRow[];
}) {
  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Configurações" title={title} description={description} />
      <p className="rounded-lg border border-dashed border-[var(--stayo-gold)] bg-[var(--stayo-gold-soft)]/40 px-3 py-2 text-xs">Demonstração visual — ativação após integração com o Core. Nenhuma alteração é gravada.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.title} className="admin-panel flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--stayo-forest-soft)] text-[var(--stayo-forest)]"><Icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><b className="block text-sm">{r.title}</b><small className="block text-[var(--admin-muted)]">{r.detail}</small></div>
            <AdminStatusBadge tone="neutral">{r.badge}</AdminStatusBadge>
          </div>
        ))}
      </div>
    </div>
  );
}
