// Comodidades e itens do imóvel — catálogo de atalhos por tipo de ambiente.
// Os itens padrão só simplificam; cada ambiente aceita itens livres.

export type RoomKind = "cozinha" | "sala" | "quarto" | "banheiro" | "lavabo" | "servico" | "externa" | "geral" | "outro";

export interface ItemDef {
  key: string;
  label: string;
  /** Variações selecionáveis, cada uma com quantidade (ex.: tipos de cama). */
  options?: string[];
  /** Pede a empresa responsável (texto livre). */
  company?: boolean;
  /** Subitens abertos quando o item está marcado. */
  sub?: ItemDef[];
  /** No painel unificado, subitens entram como linhas Sim/Não dentro da própria linha. */
  subAnswers?: boolean;
}

export interface SectionDef {
  title: string;
  items: ItemDef[];
}

export interface ItemState {
  on?: boolean;
  qty?: number | null;
  brand?: string;
  company?: string;
  notes?: string;
  characteristics?: Record<string, string>;
  opts?: Record<string, number>;
}

export interface CustomItem extends ItemState {
  id: string;
  name: string;
  supplier?: string;
}

export interface BathState {
  furnitureSupplier?: string | null;
  items: Record<string, ItemState>;
  custom: CustomItem[];
}

export interface RoomState {
  id: string;
  name: string;
  kind: RoomKind;
  furnitureSupplier?: string | null;
  items: Record<string, ItemState>;
  custom: CustomItem[];
  /** Quarto com banheiro privativo. */
  suite?: boolean;
  bath?: BathState;
  /** Marca e instalador de ar, aquecimento e móveis. */
  install?: RoomInstall;
}

export interface AmenitiesData {
  rooms: RoomState[];
}

const climate: SectionDef = {
  title: "Climatização",
  items: [
    { key: "ar_condicionado", label: "Ar-condicionado", options: ["Split", "Cassete"], company: true },
    { key: "aquecedor", label: "Aquecedor", options: ["Ar-condicionado", "Calefação", "Aquecedor elétrico"], company: true },
  ],
};

export const ROOM_SECTIONS: Record<RoomKind, SectionDef[]> = {
  cozinha: [
    {
      title: "Eletrodomésticos",
      items: [
        {
          key: "eletrodomesticos", label: "Eletrodomésticos", subAnswers: true,
          sub: [
            { key: "micro_ondas", label: "Micro-ondas" },
            { key: "forno_convencional", label: "Forno convencional" },
            { key: "air_fryer", label: "Airfryer" },
            { key: "torradeira", label: "Torradeira" },
            { key: "cafeteira_de_capsulas", label: "Cafeteira de cápsulas" },
            { key: "cafeteira_eletrica", label: "Cafeteira elétrica" },
            { key: "chaleira_eletrica", label: "Chaleira elétrica" },
            { key: "geladeira", label: "Geladeira" },
            { key: "frigobar", label: "Frigobar" },
            { key: "adega", label: "Adega" },
            { key: "purificador_de_agua", label: "Purificador de água" },
            { key: "maquina_de_lavar_louca", label: "Máquina de lavar louça" },
          ],
        },
      ],
    },
    {
      title: "Utensílios",
      items: [
        "Abridor de vinho",
        {
          key: "panelas", label: "Panelas", subAnswers: true,
          sub: [
            { key: "panelas", label: "Panelas" },
            { key: "frigideira", label: "Frigideira" },
          ],
        },
        {
          key: "formas", label: "Formas", subAnswers: true,
          sub: [
            { key: "forma_de_pizza", label: "Forma de pizza" },
            { key: "formas_diversas", label: "Formas diversas" },
            { key: "forma_de_bolo", label: "Forma de bolo" },
          ],
        },
        {
          key: "copos", label: "Copos", subAnswers: true,
          sub: [
            { key: "copos_de_vidro", label: "Copos" },
            { key: "tacas_de_vinho", label: "Taça de vinho" },
            { key: "tacas_de_espumante", label: "Taça de espumante" },
            { key: "xicaras_de_cafe_com_pires", label: "Xícara" },
            { key: "pires", label: "Píres" },
          ],
        },
        {
          key: "talheres", label: "Talheres", subAnswers: true,
          sub: [
            { key: "talheres", label: "Talheres" },
            { key: "talheres_infantis", label: "Talheres infantis" },
            { key: "facas_de_corte", label: "Facas de corte" },
          ],
        },
      ].map((l) => (typeof l === "string" ? { key: slug(l), label: l } : l)),
    },
    {
      title: "Pia e limpeza",
      items: [
        "Escorredor de pia",
        {
          key: "limpeza", label: "Limpeza", subAnswers: true,
          sub: [
            { key: "lixeira", label: "Lixeira" },
            { key: "vassoura", label: "Vassoura" },
            { key: "pa_de_lixo", label: "Pá de lixo" },
            { key: "aspirador_de_po", label: "Aspirador de pó" },
            { key: "rodo_mop", label: "Rodo / mop" },
          ],
        },
      ].map((l) => (typeof l === "string" ? { key: slug(l), label: l } : l)),
    },
    {
      title: "Churrasqueira",
      items: [
        {
          key: "churrasqueira",
          label: "Churrasqueira",
          subAnswers: true,
          sub: [
            { key: "faca_para_churrasco", label: "Faca para churrasco" },
            { key: "tabua_de_churrasco", label: "Tábua de churrasco" },
            { key: "espeto_duplo", label: "Espeto duplo" },
            { key: "espeto_simples", label: "Espeto simples" },
            { key: "grelha", label: "Grelha", options: ["Aramada", "Moeda", "Argentina"] },
            { key: "suporte_lateral", label: "Suporte lateral" },
            { key: "lampada", label: "Lâmpada" },
            { key: "exaustor", label: "Exaustor" },
          ],
        },
      ],
    },
  ],
  sala: [
    { title: "Itens", items: [{ key: "televisao", label: "Televisão" }, { key: "sofa", label: "Sofá" }, { key: "mesa_jantar", label: "Mesa de jantar" }] },
    climate,
  ],
  quarto: [
    {
      title: "Cama e itens",
      items: [
        { key: "camas", label: "Camas", options: ["Solteiro", "Auxiliar", "Casal", "Queen", "King"] },
        { key: "televisao", label: "Televisão" },
        { key: "travesseiros", label: "Travesseiros", options: ["Alto", "Baixo"] },
      ],
    },
    {
      title: "Enxoval",
      items: [
        "Edredom", "Capa de edredom", "Lençol com elástico", "Lençol sem elástico", "Fronha",
        "Capa de travesseiro impermeável", "Capa de colchão impermeável",
      ].map((l) => ({ key: slug(l), label: l })),
    },
    climate,
  ],
  banheiro: [
    { title: "Itens", items: ["Lixeira", "Decoração", "Secador de cabelo", "Toalheiro elétrico"].map((l) => ({ key: slug(l), label: l })) },
  ],
  lavabo: [
    { title: "Itens", items: ["Lixeira", "Decoração", "Porta-toalha"].map((l) => ({ key: slug(l), label: l })) },
  ],
  servico: [
    {
      title: "Lavanderia",
      items: [
        {
          key: "lavanderia", label: "Lavanderia", subAnswers: true,
          sub: [
            { key: "maquina_de_lavar", label: "Máquina de lavar" },
            { key: "maquina_lava_e_seca", label: "Máquina lava e seca" },
            { key: "maquina_de_secar", label: "Máquina de secar" },
          ],
        },
        "Ferro de passar", "Tábua de passar", "Varal",
      ].map((l) => (typeof l === "string" ? { key: slug(l), label: l } : l)),
    },
  ],
  externa: [{ title: "Itens", items: ["Mesa externa", "Cadeiras", "Espreguiçadeira"].map((l) => ({ key: slug(l), label: l })) }],
  geral: [
    {
      title: "Instalações",
      items: [{ key: "aquecimento_agua", label: "Aquecimento da água", options: ["Elétrico", "Boiler a gás"], company: true }],
    },
  ],
  outro: [],
};

export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  cozinha: "Cozinha", sala: "Sala", quarto: "Quarto", banheiro: "Banheiro", lavabo: "Lavabo", servico: "Área de serviço",
  externa: "Área externa", geral: "Geral do imóvel", outro: "Outro ambiente",
};

export function slug(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function uid() {
  return crypto.randomUUID();
}

export interface Composition {
  bedrooms: number;
  bathrooms: number;
  lavatories: number;
}

/** Persisted room composition is authoritative; absent composition retains legacy counts. */
export function suiteCount(data: unknown, legacy: number | null = null): number | null {
  if (!data || typeof data !== "object" || !("rooms" in data) || !Array.isArray(data.rooms)) return legacy;
  return data.rooms.filter((r: unknown) => r && typeof r === "object" && "kind" in r && r.kind === "quarto" && "suite" in r && r.suite === true).length;
}

const pad = (n: number) => String(n).padStart(2, "0");
const mk = (kind: RoomKind, name: string): RoomState => ({ id: uid(), kind, name, items: {}, custom: [] });

/** Ambientes iniciais conforme a composição cadastrada. */
export function defaultRooms(bedrooms: number | null | undefined, bathrooms?: number | null, lavatories?: number | null): RoomState[] {
  return reconcileRooms([mk("cozinha", "Cozinha"), mk("sala", "Sala"), mk("geral", "Geral do imóvel")], {
    bedrooms: Math.max(1, bedrooms ?? 1),
    bathrooms: Math.max(1, bathrooms ?? 1),
    lavatories: Math.max(0, lavatories ?? 0),
  });
}

function isEmpty(r: RoomState) {
  return roomProgress(r).marked === 0 && !r.furnitureSupplier && !r.suite;
}

/**
 * Ajusta quartos, banheiros sociais e lavabos à composição. Banheiros de suíte
 * contam no total de banheiros. Nunca remove ambiente com algo marcado.
 */
export function reconcileRooms(rooms: RoomState[], c: Composition): RoomState[] {
  let out = [...rooms];
  const fit = (kind: RoomKind, target: number, name: (i: number, total: number) => string) => {
    let list = out.filter((r) => r.kind === kind);
    for (let i = list.length; i < target; i++) {
      const r = mk(kind, name(i, target));
      const gi = out.findIndex((x) => x.kind === "geral");
      out = gi < 0 ? [...out, r] : [...out.slice(0, gi), r, ...out.slice(gi)];
    }
    list = out.filter((r) => r.kind === kind);
    for (let i = list.length - 1; i >= target; i--) {
      const r = list[i];
      if (r && isEmpty(r)) out = out.filter((x) => x.id !== r.id);
    }
  };
  fit("quarto", c.bedrooms, (i) => `Quarto ${pad(i + 1)}`);
  const suites = out.filter((r) => r.kind === "quarto" && r.suite).length;
  fit("banheiro", Math.max(0, c.bathrooms - suites), (i) => `Banheiro ${pad(i + 1)}`);
  fit("lavabo", c.lavatories, (i, t) => (t > 1 ? `Lavabo ${pad(i + 1)}` : "Lavabo"));
  return out;
}

/** Liga/desliga suíte: renomeia e cria o banheiro privativo. */
export function toggleSuite(room: RoomState, on: boolean): RoomState {
  const auto = /^(Quarto|Suíte) \d+$/.test(room.name);
  const num = room.name.match(/\d+$/)?.[0] ?? "";
  return {
    ...room,
    suite: on,
    name: auto ? `${on ? "Suíte" : "Quarto"} ${num}` : room.name,
    bath: room.bath ?? { items: {}, custom: [] },
  };
}

function allDefs(kind: RoomKind): ItemDef[] {
  return ROOM_SECTIONS[kind].flatMap((s) => s.items.flatMap((i) => [i, ...(i.sub ?? [])]));
}

export function roomProgress(room: RoomState) {
  const count = (items: Record<string, ItemState>, custom: CustomItem[]) =>
    Object.values(items).filter((i) => i.on).length + custom.length;
  const bath = room.suite && room.bath ? count(room.bath.items, room.bath.custom) : 0;
  return { marked: count(room.items, room.custom) + bath, total: allDefs(room.kind).length + room.custom.length };
}

// ---- Equipamentos e instalações por ambiente (marca + instalador) ----
export type InstallKey = "ar" | "aquecimento" | "moveis";
export type InstallField = "brand" | "installer";
export const INSTALL_ROWS: Array<{ key: InstallKey; label: string }> = [
  { key: "ar", label: "Ar-condicionado" },
  { key: "aquecimento", label: "Aquecimento" },
  { key: "moveis", label: "Móveis" },
];
export interface InstallState {
  brand?: string;
  installer?: string;
  /** Campos ajustados à mão neste ambiente ("brand" | "installer"); não recebem replicação. */
  manual?: InstallField[];
  source?: Partial<Record<InstallField, string>>;
  onSource?: string;
  onManual?: boolean;
}
export type RoomInstall = Partial<Record<InstallKey, InstallState>>;

export const hasInstall = (kind: RoomKind) => kind !== "geral";

export function installValue(room: RoomState, key: InstallKey, field: InstallField) {
  const v = room.install?.[key]?.[field];
  if (v !== undefined) return v;
  return key === "moveis" && field === "installer" ? room.furnitureSupplier ?? "" : "";
}

/**
 * Grava o campo no ambiente editado (marcado como manual) e replica para os
 * demais ambientes que ainda não tiveram esse campo ajustado manualmente.
 */
export function setInstall(rooms: RoomState[], roomId: string, key: InstallKey, field: InstallField, value: string): RoomState[] {
  const source = rooms.find((r) => r.install?.[key]?.source?.[field])?.install?.[key]?.source?.[field]
    ?? rooms.find((r) => r.install?.[key]?.manual?.includes(field))?.id;
  const replicate = !source || source === roomId;
  const previous = rooms.find((r) => r.id === roomId);
  const previousValue = previous ? installValue(previous, key, field) : "";
  return rooms.map((r) => {
    if (!hasInstall(r.kind)) return r;
    const cur = (r.install ?? {}) as RoomInstall;
    const st = cur[key] ?? {};
    const isSource = r.id === roomId;
    if (!isSource && (!replicate || st.manual?.includes(field))) return r;
    if (!isSource && installValue(r, key, field) && installValue(r, key, field) !== previousValue) return r;
    const manual = isSource ? Array.from(new Set([...(st.manual ?? []), field])) : st.manual;
    const next = { ...r, install: { ...cur, [key]: { ...st, [field]: value, manual, source: { ...st.source, [field]: source ?? roomId } } } } as RoomState;
    if (key === "moveis" && field === "installer") next.furnitureSupplier = value || null;
    return next;
  });
}

export function setInstallationAnswer(rooms: RoomState[], roomId: string, key: InstallKey, on: boolean): RoomState[] {
  const itemKey = key === "ar" ? "ar_condicionado" : key === "aquecimento" ? "aquecedor" : "moveis";
  const source = rooms.find((r) => r.install?.[key]?.onSource)?.install?.[key]?.onSource;
  return rooms.map((r) => {
    if (!hasInstall(r.kind)) return r;
    const st = r.install?.[key] ?? {};
    const local = r.id === roomId;
    if (!local && (on === false || (source && source !== roomId) || st.onManual || r.items[itemKey]?.on === false)) return r;
    return { ...r, items: { ...r.items, [itemKey]: { ...r.items[itemKey], on } }, install: { ...r.install, [key]: { ...st, onSource: source ?? roomId, onManual: local || st.onManual === true } } };
  });
}
