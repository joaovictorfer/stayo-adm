import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BedDouble,
  FileText,
  PackageCheck,
  Upload,
  Check,
  History,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyCentsInput } from "@/components/ui/money-input";
import {
  getLinenWorkspace,
  importLinenDocument,
  saveLinenAction,
  openLinenDocument,
  uploadLinenEvidence,
} from "@/lib/api/core-client";
import { brl, linenNeeds, linenPayloadSchema, allocateLinen, linenMatches, linenDocumentDifferences, type LinenPayload } from "@/lib/linen";
import { GuidePanel } from "../guide/GuidePanel";
type Doc = {
  id: string;
  kind: string;
  payload: unknown;
  status: string;
  revision: number;
  filename: string;
};
export function LinenWorkspace({ implementationId }: { implementationId: string }) {
  const get = useServerFn(getLinenWorkspace),
    upload = useServerFn(importLinenDocument),
    save = useServerFn(saveLinenAction),
    open = useServerFn(openLinenDocument),
    uploadEvidence = useServerFn(uploadLinenEvidence);
  const qc = useQueryClient(),
    key = ["linen", implementationId];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { implementationId } }) });
  const [tab, setTab] = useState("needs"),
    [kind, setKind] = useState<"quote" | "order" | "invoice">("order");
  const [editing, setEditing] = useState<{
    doc: Doc;
    payload: LinenPayload;
    correcting?: boolean;
  } | null>(null);
  const [receipt, setReceipt] = useState<{
    doc: Doc;
    index: number;
    name: string;
    max: number;
  } | null>(null);
  const [quantity, setQuantity] = useState(1),
    [notes, setNotes] = useState(""),
    [condition, setCondition] = useState<"good" | "defect" | "mismatch">("good");
  const [existing, setExisting] = useState<{ key: string; name: string; quantity: number } | null>(
    null,
  );
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [savingEvidence, setSavingEvidence] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const mutation = useMutation({
    mutationFn: async (
      data: NonNullable<Parameters<typeof save>[0]> extends { data?: infer D } ? D : never,
    ) => save({ data }),
    onSuccess: () => {
      toast.success("Enxoval atualizado");
      setEditing(null);
      setReceipt(null);
      setExisting(null);
      void refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const importing = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("implementationId", implementationId);
      form.set("kind", kind);
      form.set("file", file);
      return upload({ data: form });
    },
    onSuccess: () => {
      toast.success("Documento pronto para revisão");
      void refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  if (q.isPending)
    return <div className="py-12 text-center text-muted-foreground">Carregando enxoval…</div>;
  if (q.isError)
    return (
      <div role="alert">
        <p>Não foi possível consultar o enxoval.</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const data = q.data,
    needs = linenNeeds(data.rooms);
  const docs = data.documents as Doc[];
  const events = data.events.map((e) => ({ ...e, payload: e.payload as Record<string, unknown> }));
  const confirmed = docs.filter((d) => d.status === "confirmed" && d.kind === "order");
  const total = confirmed.reduce((s, d) => s + linenPayloadSchema.parse(d.payload).totalCents, 0);
  const getPrice = (name: string, size: string) => {
    for (const d of [...data.prices].sort((a, b) =>
      String((b.payload as unknown as LinenPayload).date).localeCompare(
        String((a.payload as unknown as LinenPayload).date),
      ),
    )) {
      const p = linenPayloadSchema.parse(d.payload);
      const i = p.items.findIndex(
        (x) =>
          linenMatches(x, name, size),
      );
      if (i >= 0) return Math.round((allocateLinen(p)[i] ?? 0) / (p.items[i]?.quantity ?? 1));
    }
    return null;
  };
  const rows = needs.map((n) => {
    const owned = data.existing.find((e) => e.item_key === n.key)?.quantity ?? 0;
    const missing = Math.max(0, n.required - owned);
    return { ...n, owned, missing, price: getPrice(n.name, n.size) };
  });
  const estimate = rows.reduce((s, n) => s + (n.price ?? 0) * n.missing, 0),
    uncoted = rows.filter((n) => n.missing && n.price === null).length;
  const quote = docs.find(d => d.kind === "quote");
  const differences = quote ? confirmed.flatMap(d => linenDocumentDifferences(linenPayloadSchema.parse(d.payload), linenPayloadSchema.parse(quote.payload))) : [];
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold">
            <BedDouble className="size-5 text-primary" />
            Enxoval do imóvel
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mínimo duplicado · pedido e recebimento separados
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {data.rooms.rooms.length} ambientes cadastrados
        </span>
      </header>
      {data.rooms.rooms.some(r => r.kind === "quarto" && !Object.values(r.items["travesseiros"]?.opts ?? {}).some(v => v > 0)) && <p className="text-sm text-muted-foreground">Estimativa parcial das camas cadastradas: falta especificar travesseiros e conferir o enxoval compatível com a união de 1,76 m; a queen padrão tem 1,58 m. O custo real do pedido permanece separado.</p>}
      {differences.length > 0 && (tab === "documents" || tab === "receipts") && <details className="rounded-lg border border-destructive/30 bg-muted p-3"><summary className="cursor-pointer text-sm font-medium">Conferir orçamento × pedido · {differences.length} diferenças</summary><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{differences.map((d,i)=><li key={i}>{d}</li>)}<li>Confira a identificação: bordado no orçamento e bandeira no pedido não são equivalentes automaticamente.</li></ul></details>}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            title: "Mínimo necessário",
            value: rows.reduce((s, n) => s + n.required, 0) + " peças",
          },
          { title: "Existente conferido", value: rows.reduce((s, n) => s + n.owned, 0) + " peças" },
          {
            title: "Estimativa de compra",
            value: rows.length
              ? uncoted
                ? "Cotação incompleta"
                : brl(estimate)
              : "Camas pendentes",
          },
          { title: "Pedidos confirmados", value: brl(total) },
        ].map((s) => (
          <div key={s.title} className="rounded-lg bg-muted px-4 py-3">
            <dt className="text-xs text-muted-foreground">{s.title}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <nav className="flex gap-1 overflow-x-auto border-b pb-2" aria-label="Enxoval">
        {[
          { id: "needs", name: "Necessidade", icon: BedDouble },
          { id: "documents", name: "Documentos e compras", icon: FileText },
          { id: "receipts", name: "Recebimento", icon: PackageCheck },
          { id: "prices", name: "Custos e histórico", icon: History },
          { id: "guide", name: "Guia existente", icon: ClipboardList },
        ].map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(t.id)}
            className="shrink-0"
          >
            <t.icon className="size-4" />
            {t.name}
          </Button>
        ))}
      </nav>
      {tab === "needs" && (
        <div>
          {!rows.length ? (
            <div className="py-8 text-center">
              <BedDouble className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-medium">Camas ainda não especificadas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quartos e tipos de cama precisam estar preenchidos na ficha do imóvel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    {[
                      "Ambiente / item",
                      "Tamanho",
                      "Mínimo",
                      "Já possui",
                      "Falta",
                      "Estimativa",
                      "",
                    ].map((h, i) => (
                      <th key={i} className="p-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((n) => (
                    <tr key={n.key} className="border-b">
                      <td className="p-3">
                        <span className="block text-xs text-muted-foreground">{n.room}</span>
                        {n.name}
                      </td>
                      <td className="p-3">{n.size}</td>
                      <td className="p-3 tabular-nums">{n.required}</td>
                      <td className="p-3 tabular-nums">{n.owned}</td>
                      <td className="p-3 font-semibold tabular-nums">{n.missing}</td>
                      <td className="p-3 tabular-nums whitespace-nowrap">
                        {n.price === null ? "Sem cotação" : brl(n.price * n.missing)}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setExisting({
                              key: n.key,
                              name: `${n.room} · ${n.name}`,
                              quantity: n.owned,
                            });
                            setNotes("");
                          }}
                        >
                          Conferir existente
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab === "documents" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Tipo de documento"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="quote">Orçamento</option>
              <option value="order">Pedido realizado</option>
              <option value="invoice">Nota fiscal</option>
            </select>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium">
              <Upload className="size-4" />
              {importing.isPending ? "Lendo documento…" : "Anexar documento"}
              <input
                aria-label="Anexar documento de enxoval"
                className="sr-only"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                disabled={importing.isPending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importing.mutate(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-xs text-muted-foreground">
              PDF, JPG ou PNG · até 10 MB · Lovable AI
            </span>
          </div>
          {!docs.length && (
            <p className="py-8 text-center text-muted-foreground">Nenhum documento anexado.</p>
          )}
          {docs.map((doc) => {
            const p = linenPayloadSchema.parse(doc.payload);
            return (
              <article key={doc.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase text-muted-foreground">
                      {{ quote: "Orçamento", order: "Pedido", invoice: "Nota fiscal" }[doc.kind]} ·{" "}
                      {p.date}
                    </span>
                    <h4 className="mt-1 font-semibold">
                      {p.supplier} · {p.number || "Sem número"}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {p.items.length} itens ·{" "}
                      {p.delivery ? `Entrega prevista ${p.delivery}` : "Sem data de entrega"}
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-lg tabular-nums">{brl(p.totalCents)}</strong>
                    <p className="text-xs text-muted-foreground">
                      {doc.status === "review"
                        ? "Revisão pendente"
                        : "Confirmado · versão " + doc.revision}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void open({ data: { id: doc.id } })
                        .then((url) => window.open(url, "_blank", "noopener"))
                        .catch((e) => toast.error(e.message));
                    }}
                  >
                    <FileText className="size-4" />
                    Original
                  </Button>
                  <Button
                    size="sm"
                    variant={doc.status === "review" ? "default" : "ghost"}
                    onClick={() => setEditing({ doc, payload: structuredClone(p) })}
                  >
                    {doc.status === "review" ? "Revisar itens" : "Consultar itens"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {tab === "receipts" && (
        <div className="space-y-5">
          {!confirmed.length && (
            <p className="py-8 text-center text-muted-foreground">
              Confirme um pedido para iniciar a conferência da entrega.
            </p>
          )}
          {confirmed.map((doc) => {
            const p = linenPayloadSchema.parse(doc.payload);
            return (
              <section key={doc.id}>
                <h4 className="mb-3 font-semibold">
                  Pedido {p.number} · {p.supplier}
                </h4>
                <div className="divide-y">
                  {p.items.map((item, index) => {
                    const e = events.filter(
                        (x) =>
                          x.document_id === doc.id &&
                          x.kind === "received" &&
                          x.payload["index"] === index,
                      ),
                      received = e.reduce((s, x) => s + Number(x.payload["quantity"]), 0),
                      good = e
                        .filter((x) => x.payload["condition"] === "good")
                        .reduce((s, x) => s + Number(x.payload["quantity"]), 0);
                    return (
                      <div
                        key={index}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.size} · {item.color}
                          </p>
                          <p className="mt-1 text-xs">
                            Pedido {item.quantity} · Recebido {received} · Bom estado {good} ·
                            Pendente {item.quantity - good}
                          </p>
                        </div>
                        {good < item.quantity ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReceipt({
                                doc,
                                index,
                                name: item.name,
                                max: item.quantity - good,
                              });
                              setQuantity(1);
                              setCondition("good");
                              setNotes("");
                            }}
                          >
                            <PackageCheck className="size-4" />
                            Conferir
                          </Button>
                        ) : (
                          <span className="flex items-center gap-1 text-sm">
                            {good === item.quantity ? (
                              <Check className="size-4 text-primary" />
                            ) : (
                              <AlertTriangle className="size-4 text-destructive" />
                            )}
                            {good === item.quantity ? "Conferido" : "Divergência registrada"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {tab === "prices" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {uncoted
              ? `${uncoted} itens sem cotação compatível.`
              : "Referências verificadas por fornecedor e especificação."}
          </p>
          {data.prices.map((d) => {
            const p = linenPayloadSchema.parse(d.payload),
              allocated = allocateLinen(p);
            return (
              <section key={d.id}>
                <h4 className="font-semibold">
                  {p.supplier} · {p.date} · {d.kind === "quote" ? "Cotação" : "Compra"}
                </h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="p-2">Código / item</th>
                        <th className="p-2">Medidas e cor</th>
                        <th className="p-2 text-right">Unitário</th>
                        <th className="p-2 text-right">Efetivo / unidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.items.map((i, n) => (
                        <tr key={n} className="border-b">
                          <td className="p-2">
                            {i.code} · {i.name}
                          </td>
                          <td className="p-2">
                            {i.size} · {i.color}
                          </td>
                          <td className="p-2 text-right tabular-nums">{brl(i.unitCents)}</td>
                          <td className="p-2 text-right tabular-nums">
                            {brl(Math.round((allocated[n] ?? 0) / i.quantity))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          <h4 className="font-semibold">Histórico do imóvel</h4>
          {events.map((e) => (
            <div key={e.id} className="border-b py-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(e.created_at).toLocaleString("pt-BR")}
              </span>{" "}
              ·{" "}
              {{
                received: "Recebimento registrado",
                confirmed: "Documento confirmado",
                existing: "Existente conferido",
              }[e.kind] ?? e.kind}
              {e.payload["notes"] ? ` · ${e.payload["notes"]}` : ""}
            </div>
          ))}
        </div>
      )}
      {tab === "guide" && <GuidePanel implementationId={implementationId} guideType="enxoval" />}
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.doc.status === "review" ? "Revisar documento" : "Pedido confirmado"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Fornecedor
                  <Input
                    value={editing.payload.supplier}
                    disabled={editing.doc.status === "confirmed" && !editing.correcting}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        payload: { ...editing.payload, supplier: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="text-sm">
                  Número
                  <Input
                    value={editing.payload.number}
                    disabled={editing.doc.status === "confirmed" && !editing.correcting}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        payload: { ...editing.payload, number: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr>
                      {[
                        "Código / descrição",
                        "Categoria para cálculo",
                        "Tamanho / medidas",
                        "Cor",
                        "Qtd.",
                        "Unitário",
                      ].map((x) => (
                        <th className="p-2 text-left" key={x}>
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editing.payload.items.map((i, n) => (
                      <tr key={n}>
                        {(
                          ["name", "category", "size", "color", "quantity", "unitCents"] as const
                        ).map((field) => (
                          <td className="p-1" key={field}>
                            {field === "unitCents" ? (
                              <MoneyCentsInput
                                cents={i.unitCents}
                                disabled={editing.doc.status === "confirmed" && !editing.correcting}
                                onCentsChange={(v) => {
                                  const items = [...editing.payload.items];
                                  items[n] = { ...i, unitCents: v };
                                  setEditing({
                                    ...editing,
                                    payload: { ...editing.payload, items },
                                  });
                                }}
                              />
                            ) : (
                              <Input
                                aria-label={`${field} item ${n + 1}`}
                                type={field === "quantity" ? "number" : "text"}
                                value={i[field]}
                                disabled={editing.doc.status === "confirmed" && !editing.correcting}
                                onChange={(e) => {
                                  const items = [...editing.payload.items];
                                  items[n] = {
                                    ...i,
                                    [field]:
                                      field === "quantity"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  };
                                  setEditing({
                                    ...editing,
                                    payload: { ...editing.payload, items },
                                  });
                                }}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["discountCents", "freightCents", "totalCents"] as const).map((f, n) => (
                  <label className="text-sm" key={f}>
                    {["Desconto", "Frete", "Total"][n]}
                    <MoneyCentsInput
                      disabled={editing.doc.status === "confirmed" && !editing.correcting}
                      cents={editing.payload[f]}
                      onCentsChange={(v) =>
                        setEditing({ ...editing, payload: { ...editing.payload, [f]: v } })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="text-sm">
                Observações
                <Textarea
                  disabled={editing.doc.status === "confirmed" && !editing.correcting}
                  value={editing.payload["notes"]}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      payload: { ...editing.payload, notes: e.target.value },
                    })
                  }
                />
              </label>
              {editing.doc.status === "confirmed" && !editing.correcting && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing({ ...editing, correcting: true });
                    setNotes("");
                  }}
                >
                  Corrigir com motivo
                </Button>
              )}
              {editing.correcting && (
                <Textarea
                  aria-label="Motivo da correção"
                  placeholder="Motivo da correção"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              )}
              {(editing.doc.status === "review" || editing.correcting) && (
                <Button
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      action: editing.correcting ? "correct" : "confirm",
                      notes,
                      implementationId,
                      documentId: editing.doc.id,
                      revision: editing.doc.revision,
                      payload: editing.payload,
                    })
                  }
                >
                  <Check className="size-4" />
                  Confirmar documento revisado
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!receipt}
        onOpenChange={(v) => {
          if (!v) setReceipt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferir recebimento</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{receipt?.name}</p>
          <label className="text-sm">
            Quantidade recebida
            <Input
              aria-label="Quantidade recebida"
              type="number"
              min="1"
              max={receipt?.max}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            Condição
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3"
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof condition)}
            >
              <option value="good">Bom estado e especificação correta</option>
              <option value="defect">Com defeito</option>
              <option value="mismatch">Medida ou cor divergente</option>
            </select>
          </label>
          <label className="text-sm">
            Observações
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <Button
            disabled={mutation.isPending || !receipt || savingEvidence}
            onClick={async () => {
              let evidencePath: string | undefined;
              if (evidenceFile) {
                setSavingEvidence(true);
                try {
                  const form = new FormData(); form.set("implementationId", implementationId); form.set("file", evidenceFile);
                  evidencePath = await uploadEvidence({ data: form });
                } catch (e) { toast.error(e instanceof Error ? e.message : "Foto não salva."); setSavingEvidence(false); return; }
                setSavingEvidence(false); setEvidenceFile(null);
              }
              if (receipt)
                mutation.mutate({
                  action: "receive",
                  implementationId,
                  documentId: receipt.doc.id,
                  revision: receipt.doc.revision,
                  index: receipt.index,
                  quantity,
                  condition,
                  notes,
                  evidencePath,
                });
            }}
          >
            Registrar conferência
          </Button>
          <label className="text-sm">Foto da entrega (opcional)<Input aria-label="Foto da entrega" type="file" accept="image/jpeg,image/png" onChange={e=>setEvidenceFile(e.target.files?.[0]??null)}/></label>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!existing}
        onOpenChange={(v) => {
          if (!v) setExisting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enxoval já existente</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{existing?.name}</p>
          <label className="text-sm">
            Quantidade em bom estado
            <Input
              type="number"
              min="0"
              value={existing?.quantity ?? 0}
              onChange={(e) => {
                if (existing) setExisting({ ...existing, quantity: Number(e.target.value) });
              }}
            />
          </label>
          <Textarea
            aria-label="Observações do existente"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              if (existing)
                mutation.mutate({
                  action: "existing",
                  implementationId,
                  itemKey: existing.key,
                  quantity: existing.quantity,
                  notes,
                });
            }}
          >
            Confirmar existente
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
