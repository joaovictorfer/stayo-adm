/**
 * Aba "Proprietários" da implantação (Fase 2).
 *
 * Vários proprietários/proponentes por implantação, cada um com papel,
 * participação e endereço próprios — relação, nunca campos duplicados.
 * Abaixo, o estado de confirmação de cada informação: o que a Stayo
 * preencheu, o que o proprietário confirmou e o que ele alterou (e ainda
 * espera revisão do time interno — nada é sobrescrito em silêncio).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  adminApi,
  fieldConfirmationsQuery,
  implementationOwnersQuery,
  ownersListQuery,
} from "../../lib/api/queries";
import {
  ownerFieldStateLabels,
  type OwnerFieldState,
} from "../../types/implementation-owner";
import { Panel } from "../data/ListStates";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const inputClass =
  "w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none";

/** Campos acompanhados na confirmação — nenhum deles é dado sensível. */
const TRACKED_FIELDS: { key: string; label: string }[] = [
  { key: "owner.name", label: "Nome do proprietário" },
  { key: "owner.phone", label: "Telefone" },
  { key: "owner.email", label: "E-mail" },
  { key: "owner.address", label: "Endereço" },
  { key: "property.address", label: "Endereço do imóvel" },
  { key: "property.unit", label: "Unidade" },
  { key: "payout.pix_key", label: "Chave Pix para repasse" },
];

const STATE_ORDER: OwnerFieldState[] = [
  "not_informed",
  "prefilled_by_stayo",
  "confirmed_by_owner",
  "changed_by_owner",
  "reviewed_by_stayo",
];

function stateColor(state: OwnerFieldState): string {
  if (state === "changed_by_owner") return "var(--stayo-warning)";
  if (state === "confirmed_by_owner" || state === "reviewed_by_stayo")
    return "var(--stayo-success)";
  if (state === "not_informed") return "var(--stayo-ink-muted)";
  return "var(--stayo-ink)";
}

export function OwnersPanel({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const links = useQuery(implementationOwnersQuery(implementationId));
  const owners = useQuery(ownersListQuery());
  const confirmations = useQuery(fieldConfirmationsQuery(implementationId));

  const [ownerId, setOwnerId] = useState("");
  const [role, setRole] = useState("proprietario");
  const [share, setShare] = useState("");
  const [address, setAddress] = useState("");

  const addLink = useMutation({
    mutationFn: () =>
      adminApi.implementationOwners.add({
        implementationId,
        ownerId,
        role,
        sharePercent: share.trim() === "" ? null : Number(share),
        address: address.trim() === "" ? null : address.trim(),
        displayOrder: links.data?.length ?? 0,
      }),
    onSuccess: () => {
      setOwnerId("");
      setShare("");
      setAddress("");
      void queryClient.invalidateQueries(implementationOwnersQuery(implementationId));
    },
  });

  const removeLink = useMutation({
    mutationFn: (id: string) => adminApi.implementationOwners.remove(id),
    onSuccess: () =>
      void queryClient.invalidateQueries(implementationOwnersQuery(implementationId)),
  });

  const setFieldState = useMutation({
    mutationFn: (input: { fieldKey: string; state: OwnerFieldState }) =>
      adminApi.fieldConfirmations.setState({ implementationId, ...input }),
    onSuccess: () => void queryClient.invalidateQueries(fieldConfirmationsQuery(implementationId)),
  });

  const ownerName = (id: string) =>
    owners.data?.find((o) => o.id === id)?.name ?? "Proprietário";

  const stateOf = (fieldKey: string): OwnerFieldState =>
    confirmations.data?.find((c) => c.fieldKey === fieldKey)?.state ?? "not_informed";

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Proprietários e proponentes">
        {links.isPending ? (
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Carregando...
          </p>
        ) : (links.data?.length ?? 0) === 0 ? (
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Nenhum proprietário vinculado a esta implantação ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.data?.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 py-2"
                style={surface}
              >
                <div>
                  <p className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                    {ownerName(link.ownerId)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {link.role}
                    {link.sharePercent !== null ? ` · ${link.sharePercent}%` : ""}
                    {link.address ? ` · ${link.address}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLink.mutate(link.id)}
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: "var(--stayo-danger)" }}
                >
                  <Trash2 size={13} />
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ownerId) addLink.mutate();
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Proprietário
            </span>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputClass}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            >
              <option value="">Selecione...</option>
              {owners.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Papel
            </span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Participação (%)
            </span>
            <input
              value={share}
              onChange={(e) => setShare(e.target.value)}
              inputMode="decimal"
              className={inputClass}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Endereço
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!ownerId || addLink.isPending}
              className="rounded-[var(--radius-control)] px-4 py-2 text-sm disabled:opacity-60"
              style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
            >
              {addLink.isPending ? "Vinculando..." : "Vincular proprietário"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Confirmação de dados">
        <p className="mb-3 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          O que o proprietário alterar fica marcado como “Alterado pelo proprietário” até o time
          interno revisar — nenhuma informação crítica é sobrescrita em silêncio.
        </p>
        <ul className="flex flex-col gap-2">
          {TRACKED_FIELDS.map((field) => {
            const state = stateOf(field.key);
            return (
              <li
                key={field.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 py-2"
                style={surface}
              >
                <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                  {field.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: stateColor(state) }}>
                    {ownerFieldStateLabels[state]}
                  </span>
                  <select
                    value={state}
                    onChange={(e) =>
                      setFieldState.mutate({
                        fieldKey: field.key,
                        state: e.target.value as OwnerFieldState,
                      })
                    }
                    className="rounded-[var(--radius-control)] border px-2 py-1 text-xs"
                    style={{ ...surface, color: "var(--stayo-ink)" }}
                  >
                    {STATE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {ownerFieldStateLabels[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
