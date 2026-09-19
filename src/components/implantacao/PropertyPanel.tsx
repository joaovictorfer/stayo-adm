/**
 * Aba "Imóvel" da implantação (Fase 3).
 *
 * Endereço estruturado com busca por CEP (serviço isolado, com
 * preenchimento manual sempre disponível), acessos, Wi-Fi e ambientes
 * (quartos com camas, banheiros e demais áreas).
 *
 * Wi-Fi e instruções de acesso são dados protegidos: ficam aqui para a
 * operação, mas nunca entram em audit log, PDF público ou portal aberto.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  adminApi,
  implementationPropertyDetailsQuery,
  implementationRoomsQuery,
} from "../../lib/api/queries";
import { normalizePostalCode, postalCodeService } from "../../lib/services/postal-code";
import { Panel } from "../data/ListStates";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const inputClass =
  "w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none";

const labelClass = "text-xs uppercase tracking-wide";

function Heading({ children }: { children: string }) {
  return (
    <h3
      className="mb-4 text-lg"
      style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
    >
      {children}
    </h3>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={labelClass} style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

type FormState = {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  propertyType: string;
  bedrooms: string;
  suites: string;
  bathrooms: string;
  parkingSpots: string;
  accessNotes: string;
  wifiNetwork: string;
  wifiPassword: string;
  notes: string;
};

const emptyForm: FormState = {
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  propertyType: "",
  bedrooms: "",
  suites: "",
  bathrooms: "",
  parkingSpots: "",
  accessNotes: "",
  wifiNetwork: "",
  wifiPassword: "",
  notes: "",
};

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function PropertyPanel({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const details = useQuery(implementationPropertyDetailsQuery(implementationId));
  const rooms = useQuery(implementationRoomsQuery(implementationId));

  const [form, setForm] = useState<FormState>(emptyForm);
  const [cepStatus, setCepStatus] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);

  const loaded = details.data;
  useEffect(() => {
    if (!loaded) return;
    setForm({
      postalCode: loaded.postalCode ?? "",
      street: loaded.street ?? "",
      number: loaded.number ?? "",
      complement: loaded.complement ?? "",
      district: loaded.district ?? "",
      city: loaded.city ?? "",
      state: loaded.state ?? "",
      propertyType: loaded.propertyType ?? "",
      bedrooms: loaded.bedrooms?.toString() ?? "",
      suites: loaded.suites?.toString() ?? "",
      bathrooms: loaded.bathrooms?.toString() ?? "",
      parkingSpots: loaded.parkingSpots?.toString() ?? "",
      accessNotes: loaded.accessNotes ?? "",
      wifiNetwork: loaded.wifiNetwork ?? "",
      wifiPassword: loaded.wifiPassword ?? "",
      notes: loaded.notes ?? "",
    });
  }, [loaded]);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      adminApi.propertyDetails.save(implementationId, {
        postalCode: toText(form.postalCode),
        street: toText(form.street),
        number: toText(form.number),
        complement: toText(form.complement),
        district: toText(form.district),
        city: toText(form.city),
        state: toText(form.state),
        propertyType: toText(form.propertyType),
        bedrooms: toNumber(form.bedrooms),
        suites: toNumber(form.suites),
        bathrooms: toNumber(form.bathrooms),
        parkingSpots: toNumber(form.parkingSpots),
        accessNotes: toText(form.accessNotes),
        wifiNetwork: toText(form.wifiNetwork),
        wifiPassword: toText(form.wifiPassword),
        notes: toText(form.notes),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["implementation-property-details", implementationId],
      }),
  });

  async function lookupPostalCode() {
    const digits = normalizePostalCode(form.postalCode);
    if (digits.length !== 8) {
      setCepStatus("Informe um CEP com 8 dígitos ou preencha o endereço manualmente.");
      return;
    }
    setLoadingCep(true);
    setCepStatus(null);
    try {
      const address = await postalCodeService.lookup(digits);
      if (!address) {
        setCepStatus("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      setForm((current) => ({
        ...current,
        postalCode: address.postalCode,
        street: address.street ?? current.street,
        district: address.district ?? current.district,
        city: address.city ?? current.city,
        state: address.state ?? current.state,
      }));
      setCepStatus("Endereço preenchido pelo CEP. Confira e ajuste se precisar.");
    } catch {
      setCepStatus("Não foi possível consultar o CEP agora. Preencha manualmente.");
    } finally {
      setLoadingCep(false);
    }
  }

  // Ambientes
  const [roomName, setRoomName] = useState("");
  const [roomKind, setRoomKind] = useState("quarto");
  const [roomBeds, setRoomBeds] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("");

  const addRoom = useMutation({
    mutationFn: () =>
      adminApi.rooms.add({
        implementationId,
        name: roomName.trim(),
        kind: roomKind.trim() || "quarto",
        beds: toText(roomBeds),
        capacity: toNumber(roomCapacity),
        displayOrder: rooms.data?.length ?? 0,
      }),
    onSuccess: () => {
      setRoomName("");
      setRoomBeds("");
      setRoomCapacity("");
      queryClient.invalidateQueries({ queryKey: ["implementation-rooms", implementationId] });
    },
  });

  const removeRoom = useMutation({
    mutationFn: (id: string) => adminApi.rooms.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["implementation-rooms", implementationId] }),
  });

  return (
    <div className="space-y-6">
      <Panel>
        <Heading>Endereço do imóvel</Heading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <span className={labelClass} style={{ color: "var(--stayo-ink-muted)" }}>
              CEP
            </span>
            <div className="flex gap-2">
              <input
                className={inputClass}
                style={surface}
                value={form.postalCode}
                onChange={(e) => set("postalCode")(e.target.value)}
                placeholder="00000-000"
              />
              <button
                type="button"
                onClick={() => void lookupPostalCode()}
                disabled={loadingCep}
                className="shrink-0 rounded-[var(--radius-control)] px-3 py-2 text-sm"
                style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
              >
                {loadingCep ? "Buscando" : "Buscar"}
              </button>
            </div>
          </div>
          <Labeled label="Logradouro">
            <input
              className={inputClass}
              style={surface}
              value={form.street}
              onChange={(e) => set("street")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Número">
            <input
              className={inputClass}
              style={surface}
              value={form.number}
              onChange={(e) => set("number")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Complemento">
            <input
              className={inputClass}
              style={surface}
              value={form.complement}
              onChange={(e) => set("complement")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Bairro">
            <input
              className={inputClass}
              style={surface}
              value={form.district}
              onChange={(e) => set("district")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Cidade">
            <input
              className={inputClass}
              style={surface}
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
            />
          </Labeled>
          <Labeled label="UF">
            <input
              className={inputClass}
              style={surface}
              value={form.state}
              onChange={(e) => set("state")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Tipo do imóvel">
            <input
              className={inputClass}
              style={surface}
              value={form.propertyType}
              onChange={(e) => set("propertyType")(e.target.value)}
              placeholder="Apartamento, casa, studio..."
            />
          </Labeled>
        </div>
        {cepStatus ? (
          <p className="mt-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            {cepStatus}
          </p>
        ) : null}
      </Panel>

      <Panel>
        <Heading>Composição</Heading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Labeled label="Quartos">
            <input
              className={inputClass}
              style={surface}
              value={form.bedrooms}
              onChange={(e) => set("bedrooms")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Suítes">
            <input
              className={inputClass}
              style={surface}
              value={form.suites}
              onChange={(e) => set("suites")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Banheiros">
            <input
              className={inputClass}
              style={surface}
              value={form.bathrooms}
              onChange={(e) => set("bathrooms")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Vagas">
            <input
              className={inputClass}
              style={surface}
              value={form.parkingSpots}
              onChange={(e) => set("parkingSpots")(e.target.value)}
            />
          </Labeled>
        </div>
      </Panel>

      <Panel>
        <Heading>Acessos e Wi-Fi</Heading>
        <p className="mb-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Informação restrita à operação. Não aparece no portal do proprietário nem em
          documentos compartilhados.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Rede Wi-Fi">
            <input
              className={inputClass}
              style={surface}
              value={form.wifiNetwork}
              onChange={(e) => set("wifiNetwork")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Senha do Wi-Fi">
            <input
              type="password"
              className={inputClass}
              style={surface}
              value={form.wifiPassword}
              onChange={(e) => set("wifiPassword")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Instruções de acesso (chaves, fechadura, portaria)">
            <textarea
              rows={3}
              className={inputClass}
              style={surface}
              value={form.accessNotes}
              onChange={(e) => set("accessNotes")(e.target.value)}
            />
          </Labeled>
          <Labeled label="Observações gerais">
            <textarea
              rows={3}
              className={inputClass}
              style={surface}
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
            />
          </Labeled>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-[var(--radius-control)] px-4 py-2 text-sm"
            style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
          >
            {save.isPending ? "Salvando..." : "Salvar dados do imóvel"}
          </button>
          {save.isError ? (
            <span className="text-sm" style={{ color: "var(--stayo-danger)" }}>
              Não foi possível salvar. Tente novamente.
            </span>
          ) : null}
          {save.isSuccess ? (
            <span className="text-sm" style={{ color: "var(--stayo-success)" }}>
              Dados salvos.
            </span>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <Heading>Ambientes</Heading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Labeled label="Nome">
            <input
              className={inputClass}
              style={surface}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Quarto 1, Sala, Varanda..."
            />
          </Labeled>
          <Labeled label="Tipo">
            <input
              className={inputClass}
              style={surface}
              value={roomKind}
              onChange={(e) => setRoomKind(e.target.value)}
              list="stayo-room-kinds"
            />
          </Labeled>
          <Labeled label="Camas">
            <input
              className={inputClass}
              style={surface}
              value={roomBeds}
              onChange={(e) => setRoomBeds(e.target.value)}
              placeholder="1 casal + 1 solteiro"
            />
          </Labeled>
          <Labeled label="Capacidade">
            <input
              className={inputClass}
              style={surface}
              value={roomCapacity}
              onChange={(e) => setRoomCapacity(e.target.value)}
            />
          </Labeled>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => addRoom.mutate()}
              disabled={roomName.trim() === "" || addRoom.isPending}
              className="w-full rounded-[var(--radius-control)] px-4 py-2 text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
            >
              Adicionar
            </button>
          </div>
        </div>
        <datalist id="stayo-room-kinds">
          <option value="quarto" />
          <option value="banheiro" />
          <option value="sala" />
          <option value="cozinha" />
          <option value="área externa" />
          <option value="serviço" />
        </datalist>

        <div className="mt-5 space-y-2">
          {rooms.isPending ? (
            <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              Carregando ambientes...
            </p>
          ) : (rooms.data?.length ?? 0) === 0 ? (
            <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              Nenhum ambiente cadastrado ainda. Comece pelos quartos e camas.
            </p>
          ) : (
            rooms.data?.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between rounded-[var(--radius-control)] border px-3 py-2"
                style={surface}
              >
                <div>
                  <p className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                    {room.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {room.kind}
                    {room.beds ? ` • ${room.beds}` : ""}
                    {room.capacity ? ` • ${room.capacity} hóspede(s)` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${room.name}`}
                  onClick={() => removeRoom.mutate(room.id)}
                  style={{ color: "var(--stayo-danger)" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
