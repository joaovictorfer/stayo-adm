import type { ReactNode } from "react";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

export function PageHeader({
  title,
  count,
  subtitle,
  children,
}: {
  title: string;
  count?: number | undefined;
  subtitle?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1
          className="truncate font-display text-2xl font-semibold text-foreground"
        >
          {title}
        </h1>
        {(subtitle || count !== undefined) && <p className="mt-1 text-xs text-muted-foreground">
          {subtitle}{subtitle && count !== undefined ? " · " : ""}{count !== undefined ? `${count} ${count === 1 ? "registro" : "registros"}` : ""}
        </p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]" style={{ borderColor: "var(--stayo-border)" }}>
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
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-[var(--radius-control)] border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/10 sm:w-72"
    />
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
      className="h-10 rounded-[var(--radius-control)] border bg-card px-3 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
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
    <div className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div
            className="h-4 w-1/3 animate-pulse rounded"
            style={{ backgroundColor: "var(--stayo-border)" }}
          />
          <div
            className="h-4 w-1/5 animate-pulse rounded"
            style={{ backgroundColor: "var(--stayo-border)" }}
          />
          <div
            className="ml-auto h-4 w-16 animate-pulse rounded"
            style={{ backgroundColor: "var(--stayo-border)" }}
          />
        </div>
      ))}
    </div>
  );
}

export function EmptyRows({ message }: { message: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-display text-sm font-semibold text-foreground">Tudo organizado por aqui</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorRows({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-4 py-16 text-center" role="alert">
      <p className="text-sm" style={{ color: "var(--stayo-danger)" }}>
        Não foi possível carregar os dados.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-[var(--radius-control)] bg-brand px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-hover"
      >
        Tentar novamente
      </button>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-card)] border p-4" style={surface}>
          <div
            className="h-3 w-24 animate-pulse rounded"
            style={{ backgroundColor: "var(--stayo-border)" }}
          />
          <div
            className="mt-3 h-4 w-40 animate-pulse rounded"
            style={{ backgroundColor: "var(--stayo-border)" }}
          />
        </div>
      ))}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]" style={{ borderColor: "var(--stayo-border)" }}>
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-medium text-foreground">
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
