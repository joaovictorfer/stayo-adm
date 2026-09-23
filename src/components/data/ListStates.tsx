import type { ReactNode } from "react";
import { AlertCircle, Inbox, Search } from "lucide-react";

import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  count,
  children,
}: {
  title: string;
  count?: number | undefined;
  children?: ReactNode;
}) {
  return (
    <AdminPageHeader
      title={title}
      meta={count !== undefined ? `${count} ${count === 1 ? "registro" : "registros"}` : undefined}
      actions={children}
    />
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="admin-panel">
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="admin-search-field w-full sm:w-72">
      <Search aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function SelectFilter({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="admin-input px-3 py-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--admin-border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="admin-skeleton h-4 w-1/3 rounded" />
          <div className="admin-skeleton h-4 w-1/5 rounded" />
          <div className="admin-skeleton ml-auto h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function EmptyRows({ message }: { message: string }) {
  return <AdminEmptyState icon={Inbox} title={message} description="A lista será atualizada assim que houver informações disponíveis." />;
}

export function ErrorRows({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert"><AdminEmptyState icon={AlertCircle} title="Não foi possível carregar os dados" description="Tente novamente em alguns instantes." action={<Button onClick={onRetry}>Tentar novamente</Button>} /></div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="admin-panel p-4">
          <div className="admin-skeleton h-3 w-24 rounded" />
          <div className="admin-skeleton mt-3 h-4 w-40 rounded" />
        </div>
      ))}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="admin-panel p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-[var(--admin-text)]">
        {value === null || value === undefined || value === "" ? "—" : value}
      </div>
    </div>
  );
}

export function NotFoundPanel({ message }: { message: string }) {
  return (
    <Panel>
      <EmptyRows message={message} />
    </Panel>
  );
}
