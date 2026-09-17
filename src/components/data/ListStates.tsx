import type { ReactNode } from "react";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1
          className="text-2xl"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          {title}
        </h1>
        {count !== undefined && (
          <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            {count} {count === 1 ? "registro" : "registros"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border" style={surface}>
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
      className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none sm:w-72"
      style={{ ...surface, color: "var(--stayo-ink)" }}
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
      className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
      style={{ ...surface, color: "var(--stayo-ink)" }}
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
    <div className="px-4 py-16 text-center text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
      {message}
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
        className="mt-3 rounded-[var(--radius-control)] px-3 py-2 text-sm"
        style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
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
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </p>
      <div className="mt-1 text-sm break-words" style={{ color: "var(--stayo-ink)" }}>
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
