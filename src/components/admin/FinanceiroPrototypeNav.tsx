import { Link } from "@tanstack/react-router";

const ACTIVE = [
  { to: "/financeiro/prototipo", label: "Visão geral" },
  { to: "/financeiro/receber-prototipo", label: "Contas a receber" },
] as const;
const SOON = ["Despesas", "Fechamentos", "Repasses", "Faturas de serviços", "Orçamentos"];

/** Menu demonstrativo do Financeiro. Grade fixa no celular: nunca rola de lado. */
export function FinanceiroPrototypeNav() {
  return (
    <nav aria-label="Financeiro" className="mb-3 grid grid-cols-2 gap-1 border-b border-[var(--admin-border)] pb-1 sm:grid-cols-4 lg:flex lg:gap-2 lg:pb-0">
      {ACTIVE.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          className="inline-flex min-h-11 items-center justify-center border-b-2 border-transparent px-2 text-center text-sm leading-tight text-[var(--admin-muted)] hover:text-[var(--admin-text)] lg:-mb-px"
          activeProps={{ className: "!border-[var(--admin-primary)] font-semibold !text-[var(--admin-text)]", "aria-current": "page" }}
          activeOptions={{ exact: true }}
        >
          {i.label}
        </Link>
      ))}
      {SOON.map((label) => (
        <span key={label} aria-disabled="true" title="Próxima fase do protótipo" className="inline-flex min-h-11 flex-col items-center justify-center px-2 text-center text-[13px] leading-tight text-[var(--admin-muted)] lg:-mb-px lg:text-sm">
          {label}
          <span className="text-[10px] uppercase tracking-wide">em breve</span>
        </span>
      ))}
    </nav>
  );
}
