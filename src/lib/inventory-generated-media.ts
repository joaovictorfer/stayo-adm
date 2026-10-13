import image0 from "@/assets/inventory-generated/acessorios-da-churrasqueira.jpg";
import image1 from "@/assets/inventory-generated/aquecimento-da-agua.jpg";
import image2 from "@/assets/inventory-generated/aquecimento.jpg";
import image3 from "@/assets/inventory-generated/ar-condicionado.jpg";
import image4 from "@/assets/inventory-generated/aspirador-de-po.jpg";
import image5 from "@/assets/inventory-generated/cadeiras.jpg";
import image6 from "@/assets/inventory-generated/capa-de-edredom.jpg";
import image7 from "@/assets/inventory-generated/capa-impermeavel-colchao.jpg";
import image8 from "@/assets/inventory-generated/capa-impermeavel-travesseiro.jpg";
import image9 from "@/assets/inventory-generated/churrasqueira.jpg";
import image10 from "@/assets/inventory-generated/decoracao.jpg";
import image11 from "@/assets/inventory-generated/edredom.jpg";
import image12 from "@/assets/inventory-generated/espreguicadeira.jpg";
import image13 from "@/assets/inventory-generated/exaustor.jpg";
import image14 from "@/assets/inventory-generated/facas-de-corte.jpg";
import image15 from "@/assets/inventory-generated/formas-diversas.jpg";
import image16 from "@/assets/inventory-generated/forno-convencional.jpg";
import image17 from "@/assets/inventory-generated/fronha.jpg";
import image18 from "@/assets/inventory-generated/geladeira.jpg";
import image19 from "@/assets/inventory-generated/grelha.jpg";
import image20 from "@/assets/inventory-generated/lencol-com-elastico.jpg";
import image21 from "@/assets/inventory-generated/lencol-sem-elastico.jpg";
import image22 from "@/assets/inventory-generated/lixeira.jpg";
import image23 from "@/assets/inventory-generated/luz.jpg";
import image24 from "@/assets/inventory-generated/maquina-de-lavar.jpg";
import image25 from "@/assets/inventory-generated/mesa-externa.jpg";
import image26 from "@/assets/inventory-generated/micro-ondas.jpg";
import image27 from "@/assets/inventory-generated/moveis.jpg";
import image28 from "@/assets/inventory-generated/porta-toalha.jpg";
import image29 from "@/assets/inventory-generated/purificador.jpg";
import image30 from "@/assets/inventory-generated/rodo-mop.jpg";
import image31 from "@/assets/inventory-generated/secadora.jpg";
import image32 from "@/assets/inventory-generated/tabua-de-passar.jpg";
import image33 from "@/assets/inventory-generated/travesseiros.jpg";
import image34 from "@/assets/inventory-generated/utensilios-de-churrasco.jpg";
import image35 from "@/assets/inventory-generated/varal.jpg";
import image36 from "@/assets/inventory-generated/vassoura.jpg";
import plates from "@/assets/inventory-generated/pratos.jpg";
import saucer from "@/assets/inventory-generated/pires.jpg";
import childrenCutlery from "@/assets/inventory-generated/talheres-infantis.jpg";
import barbecueKnife from "@/assets/inventory-generated/faca-para-churrasco.jpg";
import barbecueBoard from "@/assets/inventory-generated/tabua-de-churrasco.jpg";
import doubleSkewer from "@/assets/inventory-generated/espeto-duplo.jpg";
import singleSkewer from "@/assets/inventory-generated/espeto-simples.jpg";
import sideSupport from "@/assets/inventory-generated/suporte-lateral.jpg";
import { amenityDisplayKey } from "./inventory-amenities-view";

const images: Record<string, string> = {
  prato_de_sobremesa: plates,
  prato_fundo: plates,
  prato_raso: plates,
  pires: saucer,
  talheres_infantis: childrenCutlery,
  faca_para_churrasco: barbecueKnife,
  tabua_de_churrasco: barbecueBoard,
  espeto_duplo: doubleSkewer,
  espeto_simples: singleSkewer,
  suporte_lateral: sideSupport,
  lampada: image23,
  "acessorios_da_churrasqueira": image0,
  "aquecimento_da_agua": image1,
  "aquecimento": image2,
  "ar_condicionado": image3,
  "aspirador_de_po": image4,
  "cadeiras": image5,
  "capa_de_edredom": image6,
  "capa_impermeavel_colchao": image7,
  "capa_impermeavel_travesseiro": image8,
  "churrasqueira": image9,
  "decoracao": image10,
  "edredom": image11,
  "espreguicadeira": image12,
  "exaustor": image13,
  "facas_de_corte": image14,
  "formas_diversas": image15,
  "forno_convencional": image16,
  "fronha": image17,
  "geladeira": image18,
  "grelha": image19,
  "lencol_com_elastico": image20,
  "lencol_sem_elastico": image21,
  "lixeira": image22,
  "luz": image23,
  "maquina_de_lavar": image24,
  "mesa_externa": image25,
  "micro_ondas": image26,
  "moveis": image27,
  "porta_toalha": image28,
  "purificador": image29,
  "rodo_mop": image30,
  "secadora": image31,
  "tabua_de_passar": image32,
  "travesseiros": image33,
  "utensilios_de_churrasco": image34,
  "varal": image35,
  "vassoura": image36,
};

export function generatedInventoryImage(name: string): string | undefined {
  const key = amenityDisplayKey(name);
  const aliases: Record<string, string> = { capa_de_travesseiro_impermeavel: "capa_impermeavel_travesseiro", capa_de_colchao_impermeavel: "capa_impermeavel_colchao", purificador_de_agua: "purificador" };
  return images[aliases[key] ?? key];
}
