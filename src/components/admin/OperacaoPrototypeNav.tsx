import { Link } from "@tanstack/react-router";

const ITEMS = [
  { to: "/operacao/prototipo", label: "Visão geral" },
  { to: "/operacao/agenda-prototipo", label: "Agenda" },
  { to: "/operacao/tarefas-prototipo", label: "Tarefas" },
  { to: "/operacao/vistorias-prototipo", label: "Vistorias" },
] as const;

/** Menu demonstrativo entre os protótipos de Operação. Grade fixa: nunca rola de lado. */
export function OperacaoPrototypeNav() {
  return (
    <nav aria-label="Operação" className="mb-3 grid grid-cols-4 gap-1 border-b border-[var(--admin-border)] sm:flex sm:gap-2">
      {ITEMS.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          className="-mb-px inline-flex min-h-11 items-center justify-center border-b-2 border-transparent px-1 text-center text-[13px] leading-tight text-[var(--admin-muted)] hover:text-[var(--admin-text)] sm:px-3 sm:text-sm"
          activeProps={{ className: "!border-[var(--admin-primary)] font-semibold !text-[var(--admin-text)]", "aria-current": "page" }}
          activeOptions={{ exact: true }}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
