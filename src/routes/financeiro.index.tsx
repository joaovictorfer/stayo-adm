import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ClipboardList, DollarSign, FileText, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";

import {
  EmptyRows,
  ErrorRows,
  Field,
  ListSkeleton,
  Panel,
  SearchInput,
} from "../components/data/ListStates";
import { Drawer } from "../components/patterns/Drawer";
import { LinkedField } from "../components/patterns/LinkedField";
import {
  expensesListQuery,
  payoutsListQuery,
  serviceInvoicesListQuery,
  settlementsListQuery,
} from "../lib/api/queries";
import { formatMoney as formatMoneyOrNull } from "../lib/format";
import type { Expense, Settlement, ServiceInvoice, ServiceInvoiceStage } from "../types/core";

/**
 * Financeiro — repasses por imóvel/proprietário e faturas de serviço.
 *
 * Menor privilégio: estas telas mostram apenas imóvel, reserva, canal, valor
 * e proprietário. Nenhum dado de hóspede é lido aqui, e documento/selfie não
 * existem no contrato de dados deste módulo.
 */
export const Route = createFileRoute("/financeiro/")({
  head: () => ({
    meta: [
      { title: "Financeiro — Stayo Admin" },
      { name: "description", content: "Repasses e faturas de serviço da operação Stayo." },
      { property: "og:title", content: "Financeiro — Stayo Admin" },
      {
        property: "og:description",
        content: "Repasses e faturas de serviço da operação Stayo.",
      },
    ],
  }),
  component: FinancePage,
});

function formatMoney(value: number | null) {
  return formatMoneyOrNull(value) ?? "—";
}

const tabLabels = {
  "visao-geral": "Visão geral",
  faturas: "Faturas de serviço",
  fechamentos: "Fechamentos",
  despesas: "Despesas",
} as const;

function FinanceSummary() {
  const payoutsQuery = useQuery(payoutsListQuery());
  const invoicesQuery = useQuery(serviceInvoicesListQuery());
  const settlementsQuery = useQuery(settlementsListQuery());
  const expensesQuery = useQuery(expensesListQuery());

  const totalPayouts = (payoutsQuery.data?.data ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const pendingInvoices = (invoicesQuery.data?.data ?? []).filter((i) => !i.paidAt);
  const openSettlements = (settlementsQuery.data?.data ?? []).filter((s) => s.status === "aberto");
  const openExpenses = (expensesQuery.data?.data ?? []).filter((e) => e.status === "aberto");

  const pending = "…";

  return (
    <div className="portfolio-metrics mb-4">
      <PortfolioMetric icon={Wallet} label="Total repassado" value={
          payoutsQuery.isPending
            ? pending
            : (payoutsQuery.data?.data ?? []).length === 0
              ? "—"
              : (formatMoney(totalPayouts) ?? "—")
        }
      />
      <PortfolioMetric icon={FileText} label="Faturas pendentes" value={
          invoicesQuery.isPending
            ? pending
            : pendingInvoices.length === 0
              ? "—"
              : `${pendingInvoices.length} · ${formatMoney(pendingInvoices.reduce((s, i) => s + i.total, 0))}`
        }
        tone={pendingInvoices.length > 0 ? "warning" : "success"}
      />
      <PortfolioMetric icon={ClipboardList} label="Fechamentos em aberto" value={
          settlementsQuery.isPending
            ? pending
            : openSettlements.length === 0
              ? "—"
              : `${openSettlements.length} · ${formatMoney(openSettlements.reduce((s, x) => s + x.total, 0))}`
        }
        tone={openSettlements.length > 0 ? "warning" : "neutral"}
      />
      <PortfolioMetric icon={DollarSign} label="Despesas em aberto" value={
          expensesQuery.isPending
            ? pending
            : openExpenses.length === 0
              ? "—"
              : `${openExpenses.length} · ${formatMoney(openExpenses.reduce((s, x) => s + x.amount, 0))}`
        }
        tone={openExpenses.length > 0 ? "warning" : "neutral"}
      />
    </div>
  );
}

function FinancePage() {
  const [tab, setTab] = useState<keyof typeof tabLabels>("visao-geral");

  return (
    <>
      <AdminPageHeader eyebrow="Gestão" title="Financeiro" description="Repasses, faturas, fechamentos e despesas em leitura. Nenhum pagamento ou cobrança é gerado aqui." />
      <div className="mt-5"><FinanceSummary /></div>
      <div className="mb-4"><ModuleTabs value={tab} onChange={setTab} options={(Object.keys(tabLabels) as (keyof typeof tabLabels)[]).map((t) => ({ value: t, label: tabLabels[t] }))} /></div>

      {tab === "visao-geral" ? (
        <PayoutsTab />
      ) : tab === "faturas" ? (
        <ServiceInvoicesTab />
      ) : tab === "fechamentos" ? (
        <SettlementsTab />
      ) : (
        <ExpensesTab />
      )}
    </>
  );
}

function PayoutsTab() {
  const [q, setQ] = useState("");
  const query = useQuery(payoutsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (p) =>
        (p.propertyName ?? "").toLowerCase().includes(term) ||
        (p.ownerName ?? "").toLowerCase().includes(term) ||
        (p.reservationCode ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por imóvel, proprietário ou reserva"
        />
      </div>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q ? "Nenhum repasse encontrado para esta busca" : "Nenhum repasse registrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/financeiro/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{p.propertyName ?? p.propertyId ?? "—"}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.reservationCode ?? p.reservationId ?? "—"}
                    {p.channel ? ` · ${p.channel}` : ""}
                  </span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.ownerName ?? p.ownerId ?? "—"}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink)" }}>
                    {formatMoney(p.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

const stageOrder: ServiceInvoiceStage[] = ["emissao", "envio", "recebimento"];
const stageLabels: Record<ServiceInvoiceStage, string> = {
  emissao: "Emissão",
  envio: "Envio",
  recebimento: "Recebimento",
};

function ServiceInvoicesTab() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ServiceInvoice | null>(null);
  const query = useQuery(serviceInvoicesListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (i) =>
        i.code.toLowerCase().includes(term) ||
        i.title.toLowerCase().includes(term) ||
        (i.propertyName ?? "").toLowerCase().includes(term) ||
        (i.ownerName ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por código, imóvel ou proprietário"
        />
      </div>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q
                ? "Nenhuma fatura encontrada para esta busca"
                : "Nenhuma fatura de serviço emitida ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((invoice) => (
              <li key={invoice.id}>
                <button
                  type="button"
                  onClick={() => setSelected(invoice)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{invoice.code}</span>
                  <span>{invoice.title}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {invoice.propertyName ?? "—"}
                  </span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {invoice.ownerName ?? "—"}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: "var(--stayo-forest-soft)",
                      color: "var(--stayo-forest)",
                    }}
                  >
                    {stageLabels[invoice.stage]}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink)" }}>
                    {formatMoney(invoice.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        eyebrow="Fatura de serviço"
        title={selected?.title ?? ""}
      >
        {selected && <ServiceInvoiceDetail invoice={selected} />}
      </Drawer>
    </>
  );
}

function ServiceInvoiceDetail({ invoice }: { invoice: ServiceInvoice }) {
  const currentIndex = stageOrder.indexOf(invoice.stage);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {invoice.code}
        </p>
        <ol className="mt-2 flex gap-2">
          {stageOrder.map((stage, index) => (
            <li key={stage} className="flex flex-1 flex-col gap-1.5">
              <span
                className="h-1.5 w-full rounded-full"
                style={{
                  backgroundColor:
                    index <= currentIndex ? "var(--stayo-forest)" : "var(--stayo-border)",
                }}
              />
              <span
                className="text-xs"
                style={{
                  color: index === currentIndex ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                  fontWeight: index === currentIndex ? 600 : 400,
                }}
              >
                {stageLabels[stage]}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Imóvel" value={invoice.propertyName} />
        <Field label="Proprietário" value={invoice.ownerName} />
        <Field label="Competência" value={invoice.referenceMonth} />
        <Field label="Vencimento" value={invoice.dueDate} />
      </div>

      <div>
        <p
          className="mb-2 text-xs uppercase tracking-wide"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Serviços faturados
        </p>
        <ul
          className="divide-y rounded-[var(--radius-card)] border"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          {invoice.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {item.description}{" "}
                <span style={{ color: "var(--stayo-ink-muted)" }}>x{item.quantity}</span>
              </span>
              <span>{formatMoney(item.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between text-sm font-medium">
          <span>Total</span>
          <span>{formatMoney(invoice.total)}</span>
        </div>
      </div>

      {invoice.notes && (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          {invoice.notes}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <DisabledAction label="Visualizar PDF" />
        <DisabledAction label="Baixar PDF" />
        <DisabledAction label="Enviar por WhatsApp" />
      </div>
    </div>
  );
}

const settlementStatusLabels: Record<Settlement["status"], string> = {
  aberto: "Aberto",
  pago: "Pago",
};

function SettlementsTab() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Settlement | null>(null);
  const query = useQuery(settlementsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (s) =>
        s.code.toLowerCase().includes(term) || (s.providerName ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por referência ou prestador" />
      </div>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q ? "Nenhum fechamento encontrado para esta busca" : "Nenhum fechamento gerado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{s.code}</span>
                  <span>{s.providerName ?? s.providerId}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {s.periodStart} – {s.periodEnd}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor:
                        s.status === "pago" ? "var(--stayo-forest-soft)" : "var(--stayo-gold-soft)",
                      color: s.status === "pago" ? "var(--stayo-forest)" : "var(--stayo-warning)",
                    }}
                  >
                    {settlementStatusLabels[s.status]}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink)" }}>
                    {formatMoney(s.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        eyebrow="Fechamento"
        title={selected?.code ?? ""}
      >
        {selected && <SettlementDetail settlement={selected} />}
      </Drawer>
    </>
  );
}

function SettlementDetail({ settlement }: { settlement: Settlement }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Prestador"
          value={
            <LinkedField
              to="/prestadores/$id"
              id={settlement.providerId}
              label={settlement.providerName}
            />
          }
        />
        <Field label="Status" value={settlementStatusLabels[settlement.status]} />
        <Field label="Período" value={`${settlement.periodStart} – ${settlement.periodEnd}`} />
        <Field label="Pago em" value={settlement.paidAt} />
      </div>

      <div>
        <p
          className="mb-2 text-xs uppercase tracking-wide"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Serviços incluídos no fechamento
        </p>
        <ul
          className="divide-y rounded-[var(--radius-card)] border"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          {settlement.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                <span style={{ color: "var(--stayo-ink-muted)" }}>{item.date}</span>{" "}
                {item.propertyName ?? item.propertyId} · {item.description}
              </span>
              <span>{formatMoney(item.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between text-sm font-medium">
          <span>Total pago</span>
          <span>{formatMoney(settlement.total)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <DisabledAction label="Visualizar recibo" />
        <DisabledAction label="Baixar recibo" />
      </div>
    </div>
  );
}

const expenseStatusLabels: Record<Expense["status"], string> = {
  aberto: "Aberto",
  pago: "Pago",
};

function ExpensesTab() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Expense | null>(null);
  const query = useQuery(expensesListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (e) =>
        e.description.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term) ||
        (e.propertyName ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  const total = rows.reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Total no filtro: <span style={{ color: "var(--stayo-ink)" }}>{formatMoney(total)}</span>
        </p>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por descrição, categoria ou imóvel"
        />
      </div>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q ? "Nenhuma despesa encontrada para esta busca" : "Nenhuma despesa lançada ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelected(e)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{e.description}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>{e.category}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>{e.propertyName ?? "—"}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor:
                        e.status === "pago" ? "var(--stayo-forest-soft)" : "var(--stayo-gold-soft)",
                      color: e.status === "pago" ? "var(--stayo-forest)" : "var(--stayo-warning)",
                    }}
                  >
                    {expenseStatusLabels[e.status]}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink)" }}>
                    {formatMoney(e.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        eyebrow="Despesa"
        title={selected?.description ?? ""}
      >
        {selected && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria" value={selected.category} />
            <Field label="Imóvel" value={selected.propertyName} />
            <Field label="Status" value={expenseStatusLabels[selected.status]} />
            <Field label="Valor" value={formatMoney(selected.amount)} />
            <Field label="Vencimento" value={selected.dueDate} />
            <Field label="Pago em" value={selected.paidAt} />
          </div>
        )}
      </Drawer>
    </>
  );
}

function DisabledAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="disponível quando o Stayo Core estiver conectado"
      className="cursor-not-allowed rounded-[var(--radius-control)] border px-3 py-2 text-sm opacity-60"
      style={{
        backgroundColor: "var(--stayo-surface)",
        borderColor: "var(--stayo-border)",
        color: "var(--stayo-ink-muted)",
      }}
    >
      {label}
    </button>
  );
}
