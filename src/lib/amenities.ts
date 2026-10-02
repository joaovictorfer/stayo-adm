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
      items: ["Micro-ondas", "Torradeira", "Purificador de água", "Chaleira elétrica", "Geladeira", "Forno convencional", "Air fryer"].map(
        (l) => ({ key: slug(l), label: l }),
      ),
    },
    {
      title: "Utensílios",
      items: [
        "Abridor de vinho", "Forma de pizza", "Formas diversas", "Forma de bolo", "Panelas", "Copos",
        "Taças de vinho", "Taças de espumante", "Facas de corte", "Talheres",
      ].map((l) => ({ key: slug(l), label: l })),
    },
    {
      title: "Pia e limpeza",
      items: ["Escorredor de pia", "Lixeira", "Vassoura", "Pá de lixo", "Aspirador de pó", "Rodo / mop"].map((l) => ({ key: slug(l), label: l })),
    },
    {
      title: "Churrasqueira",
      items: [
        {
          key: "churrasqueira",
          label: "Churrasqueira",
          sub: [
            { key: "grelha", label: "Grelha", options: ["Aramada", "Moeda", "Argentina"] },
            { key: "espetos", label: "Espetos", options: ["Simples", "Duplo", "Espada"] },
            { key: "kit_churrasco", label: "Kit churrasco" },
            { key: "utensilios_churrasco", label: "Utensílios de churrasco" },
            { key: "acessorios_churrasqueira", label: "Acessórios da churrasqueira" },
            { key: "luz_churrasqueira", label: "Luz" },
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
    { title: "Itens", items: ["Lixeira", "Decoração", "Secador de cabelo"].map((l) => ({ key: slug(l), label: l })) },
  ],
  lavabo: [
    { title: "Itens", items: ["Lixeira", "Decoração", "Porta-toalha"].map((l) => ({ key: slug(l), label: l })) },
  ],
  servico: [
    { title: "Itens", items: ["Máquina de lavar", "Secadora", "Ferro de passar", "Tábua de passar", "Varal"].map((l) => ({ key: slug(l), label: l })) },
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
  fit("banheiro", Math.max(0, c.bathrooms - suites), (i, t) => (t > 1 ? `Banheiro social ${pad(i + 1)}` : "Banheiro social"));
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
