import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, ExternalLink, ImagePlus, MoreHorizontal, PackageOpen, Plus, Search, Upload, Utensils, X } from "lucide-react";
import { useMemo, useState } from "react";
import cookwareImage from "@/assets/guide-cookware.jpg";
import cutleryImage from "@/assets/guide-cutlery.jpg";
import glassesImage from "@/assets/guide-wine-glasses.jpg";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guias-implantacao-prototipo")({
  head: () => ({ meta: [
    { title: "Guia de Utensílios — Admin STAYO" },
    { name: "description", content: "Catálogo visual demonstrativo de recomendações de utensílios STAYO." },
    { property: "og:title", content: "Guia de Utensílios — Admin STAYO" },
    { property: "og:description", content: "Catálogo visual demonstrativo de recomendações de utensílios STAYO." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: UtensilsAdminPrototype,
});

type Category = "Cozinha" | "Quartos" | "Banheiros";
type Classification = "Essencial" | "Recomendado" | "Opcional";
type Item = { id:string; name:string; category:Category; quantity:string; classification:Classification; specification:string; image:string|null; tip:string; reference:string|null };

const pdfItems: Item[] = [
  { id:"talheres", name:"Talheres", category:"Cozinha", quantity:"Jogo com 12 peças", classification:"Recomendado", specification:"Inox polido ou fosco com bom acabamento.", image:cutleryImage, tip:"Prefira linhas de fácil reposição para manter o conjunto sempre uniforme.", reference:null },
  { id:"copos", name:"Copos de vidro", category:"Cozinha", quantity:"Jogo com 6 peças", classification:"Recomendado", specification:"Design liso, transparente e empilhável.", image:null, tip:"Modelos lisos são mais fáceis de repor e combinar.", reference:null },
  { id:"tacas-vinho", name:"Taças de vinho", category:"Cozinha", quantity:"Jogo com 6 peças", classification:"Recomendado", specification:"Vidro transparente, haste média e base estável.", image:glassesImage, tip:"Prefira uma linha resistente e disponível para reposição.", reference:null },
  { id:"tacas-espumante", name:"Taças de espumante", category:"Cozinha", quantity:"Jogo com 6 peças", classification:"Opcional", specification:"Agrega valor em experiências e fotos.", image:null, tip:"Mantenha o conjunto visualmente alinhado às taças de vinho.", reference:null },
  { id:"jantar", name:"Jogo de jantar", category:"Cozinha", quantity:"Para 6 pessoas", classification:"Recomendado", specification:"Pratos rasos, fundos e de sobremesa em porcelana ou cerâmica esmaltada, branca ou com detalhe minimalista.", image:null, tip:"Cores neutras facilitam a reposição e a apresentação da mesa.", reference:null },
  { id:"xicaras", name:"Xícaras de café com pires", category:"Cozinha", quantity:"6 unidades", classification:"Recomendado", specification:"Cor neutra, branca ou areia, preferencialmente empilháveis.", image:null, tip:"Priorize modelos empilháveis para ocupar menos espaço.", reference:null },
  { id:"utensilios", name:"Kit de utensílios", category:"Cozinha", quantity:"1 kit completo", classification:"Recomendado", specification:"Colher de pau, concha, escumadeira, pegador de massa, abridor e similares em inox ou nylon preto.", image:null, tip:"Escolha peças do mesmo padrão visual e resistentes ao uso frequente.", reference:null },
  { id:"panelas", name:"Jogo de panelas antiaderentes", category:"Cozinha", quantity:"Mínimo 4 peças", classification:"Recomendado", specification:"Revestimento antiaderente, cor preta ou inox, com tampa de vidro.", image:cookwareImage, tip:"Prefira uma linha com peças avulsas disponíveis para reposição.", reference:null },
  { id:"pirex", name:"Kit Pirex para forno", category:"Cozinha", quantity:"2 a 3 peças", classification:"Recomendado", specification:"Vidro temperado em tamanhos variados.", image:null, tip:"Combine tamanhos úteis para porções pequenas e refeições completas.", reference:null },
  { id:"potes", name:"Potes com tampa", category:"Cozinha", quantity:"Mínimo 4 unidades", classification:"Recomendado", specification:"Plástico transparente, tampa hermética e formato empilhável.", image:null, tip:"Conjuntos modulares organizam melhor armários e geladeira.", reference:null },
  { id:"purificador", name:"Purificador de água", category:"Cozinha", quantity:"1 unidade", classification:"Opcional", specification:"De torneira ou com filtro externo; melhora a experiência do hóspede.", image:null, tip:"Confirme a compatibilidade com a torneira antes da escolha.", reference:null },
  { id:"cafeteira", name:"Cafeteira elétrica", category:"Cozinha", quantity:"1 unidade", classification:"Recomendado", specification:"Com jarra de vidro ou térmica, ideal para 6 xícaras.", image:null, tip:"Prefira controles simples e peças fáceis de higienizar.", reference:null },
  { id:"chaleira", name:"Chaleira elétrica", category:"Cozinha", quantity:"1 unidade", classification:"Recomendado", specification:"Inox.", image:null, tip:"Um modelo compacto atende bem ao uso diário.", reference:null },
  { id:"liquidificador", name:"Liquidificador", category:"Cozinha", quantity:"1 unidade", classification:"Recomendado", specification:"Preferência por copo de vidro ou acrílico resistente.", image:null, tip:"Priorize encaixes simples e materiais resistentes.", reference:null },
  { id:"churrasco", name:"Kit churrasco", category:"Cozinha", quantity:"1 unidade", classification:"Recomendado", specification:"Faca longa, garfo ou espeto e tábuas, preferencialmente em inox e com cabo resistente.", image:null, tip:"Pode incluir bolsa ou estojo para manter as peças organizadas.", reference:null },
  { id:"cabides", name:"Cabides", category:"Quartos", quantity:"Mínimo 5 por armário", classification:"Opcional", specification:"Preferência por madeira clara ou acrílico transparente.", image:null, tip:"Use o mesmo modelo em todos os armários.", reference:null },
  { id:"ferro", name:"Ferro de passar roupa", category:"Quartos", quantity:"1 unidade", classification:"Recomendado", specification:"Sem especificação adicional no guia original.", image:null, tip:"Mantenha o item em local visível e de fácil acesso.", reference:null },
  { id:"sabonete", name:"Porta sabonete líquido", category:"Banheiros", quantity:"3 unidades", classification:"Recomendado", specification:"Preferência por cerâmica, vidro fosco ou plástico premium.", image:null, tip:"Repita o mesmo modelo nos banheiros para unidade visual.", reference:null },
  { id:"lixeira", name:"Lixeira com tampa", category:"Banheiros", quantity:"3 unidades", classification:"Recomendado", specification:"Modelo com pedal ou basculante, na cor branca ou inox.", image:null, tip:"Modelos compactos e laváveis facilitam a rotina.", reference:null },
  { id:"secador", name:"Secador de cabelo", category:"Banheiros", quantity:"1 unidade (mínimo)", classification:"Recomendado", specification:"Modelo hotel ou conforme orientação.", image:null, tip:"Guarde em local protegido da umidade.", reference:null },
];

function UtensilsAdminPrototype(){
  const [category,setCategory]=useState<"Todos"|Category>("Todos");
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<Item|null>(null);
  const [editing,setEditing]=useState(false);
  const shown=useMemo(()=>pdfItems.filter(item=>(category==="Todos"||item.category===category)&&item.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[category,query]);
  const open=(item:Item)=>{setSelected(item);setEditing(false)};
  const close=()=>{setSelected(null);setEditing(false)};
  return <main className="min-w-0 pb-12 text-[var(--admin-text)]">
    <section className="mx-auto max-w-[76rem]">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-[var(--admin-border)] pb-5">
        <div className="min-w-0"><h1 className="font-[var(--stayo-font-display)] text-2xl font-semibold text-[var(--admin-primary)] sm:text-3xl">Guia de utensílios</h1><p className="mt-1 truncate text-sm text-[var(--admin-muted)]">Biblioteca visual de recomendações STAYO.</p></div>
        <Button onClick={()=>{setSelected(pdfItems[0]??null);setEditing(true)}}><Plus/> <span className="hidden sm:inline">Adicionar item</span><span className="sm:hidden">Adicionar</span></Button>
      </header>
      <div className="mt-5"><label className="admin-input flex min-h-12 items-center gap-3 px-4"><Search className="size-5 shrink-0 text-[var(--admin-muted)]"/><input value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none" placeholder="Buscar utensílio..." aria-label="Buscar utensílio"/></label><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{(["Todos","Cozinha","Quartos","Banheiros"] as const).map(value=><Button key={value} size="sm" variant={category===value?"default":"outline"} className="shrink-0 rounded-full" onClick={()=>setCategory(value)}>{value}</Button>)}</div></div>
      {shown.length?<ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map(item=><CatalogCard key={item.id} item={item} onOpen={()=>open(item)}/>)}</ul>:<div className="mt-5 rounded-[var(--admin-radius-lg)] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center"><PackageOpen className="mx-auto size-8 text-[var(--admin-muted)]"/><h2 className="mt-3 font-semibold">Nenhum utensílio encontrado</h2><p className="mt-1 text-sm text-[var(--admin-muted)]">Tente outra busca ou categoria.</p></div>}
    </section>
    {selected&&<ItemPanel item={selected} editing={editing} onEdit={()=>setEditing(true)} onCancel={()=>setEditing(false)} onClose={close}/>} 
  </main>
}

function CatalogCard({item,onOpen}:{item:Item;onOpen:()=>void}){
  return <li><button type="button" onClick={onOpen} className="grid min-h-28 w-full grid-cols-[6.25rem_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-left shadow-[var(--admin-shadow-sm)] transition hover:border-[var(--admin-primary)] hover:shadow-[var(--admin-shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"><ItemVisual item={item} compact/><span className="min-w-0 px-1"><span className="block truncate font-semibold">{item.name}</span><span className="mt-1 block truncate text-sm text-[var(--admin-muted)]">{item.quantity}</span><ClassificationBadge value={item.classification}/></span><ChevronRight className="mr-2 size-5 shrink-0 text-[var(--admin-muted)]"/></button></li>
}

function ItemVisual({item,compact=false}:{item:Item;compact?:boolean}){
  const box=compact?"h-24 w-[6.25rem]":"aspect-[4/3] w-full";
  if(item.image)return <img src={item.image} alt={item.name} className={cn(box,"rounded-[var(--admin-radius)] object-cover")}/>;
  return <div aria-label={`Placeholder STAYO para ${item.name}`} className={cn(box,"relative grid place-items-center overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]")}><div className="absolute left-0 top-0 h-1 w-full bg-[var(--admin-success)]"/><Utensils className={cn("text-[var(--admin-primary)]",compact?"size-7":"size-12")}/><span className="absolute bottom-2 right-2"><StayoLogo variant="green" decorative className={compact?"h-3 w-auto opacity-60":"h-4 w-auto opacity-60"}/></span></div>
}

function ClassificationBadge({value}:{value:Classification}){
  return <span className={cn("mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",value==="Opcional"?"bg-[var(--admin-info-soft)] text-[var(--admin-primary)]":value==="Essencial"?"bg-[var(--admin-success-soft)] text-[var(--admin-success)]":"bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]")}>{value}</span>
}

function ItemPanel({item,editing,onEdit,onCancel,onClose}:{item:Item;editing:boolean;onEdit:()=>void;onCancel:()=>void;onClose:()=>void}){
  return <div className="fixed inset-0 z-50 bg-foreground/40" role="dialog" aria-modal="true" aria-label={editing?"Editar utensílio":"Detalhes do utensílio"} onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><aside className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-[var(--admin-surface)] shadow-[var(--admin-shadow-lg)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-none"><div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase text-[var(--admin-accent)]">{editing?"Edição demonstrativa":"Detalhe do catálogo"}</p><h2 className="truncate text-lg font-semibold">{editing?"Editar item":item.name}</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X/></Button></div>{editing?<EditItem item={item} onCancel={onCancel}/>:<ItemDetail item={item} onEdit={onEdit}/>}</aside></div>
}

function ItemDetail({item,onEdit}:{item:Item;onEdit:()=>void}){
  return <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]"><ItemVisual item={item}/><div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-2xl font-semibold">{item.name}</h3><ClassificationBadge value={item.classification}/></div><Button variant="outline" size="icon" aria-label="Mais opções"><MoreHorizontal/></Button></div><Definition label="Quantidade recomendada">{item.quantity}</Definition><Definition label="Especificação">{item.specification}</Definition><div className="mt-5 border-l-2 border-[var(--admin-success)] bg-[var(--admin-success-soft)] p-4"><p className="text-xs font-semibold uppercase text-[var(--admin-success)]">Dica STAYO</p><p className="mt-1 text-sm">{item.tip}</p></div><div className="mt-5"><p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">Indicação de compra</p><Button variant="outline" className="mt-2" disabled={!item.reference}>Abrir referência <ExternalLink/></Button>{!item.reference&&<p className="mt-2 text-xs text-[var(--admin-muted)]">Nenhuma referência cadastrada.</p>}</div><Button className="mt-6 w-full" onClick={onEdit}>Editar</Button></div></div>
}
function Definition({label,children}:{label:string;children:string}){return <div className="mt-5 border-t border-[var(--admin-border)] pt-4"><p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">{label}</p><p className="mt-1 text-sm leading-6">{children}</p></div>}

function EditItem({item,onCancel}:{item:Item;onCancel:()=>void}){
  const [classification,setClassification]=useState<Classification>(item.classification);
  return <form className="space-y-5 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onSubmit={e=>{e.preventDefault();onCancel()}}><div><FieldLabel>Foto</FieldLabel><div className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3"><ItemVisual item={item} compact/><Button type="button" variant="outline"><Upload/>{item.image?"Trocar foto":"Enviar foto"}</Button></div></div><FormField label="Nome"><Input defaultValue={item.name}/></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Categoria"><select defaultValue={item.category} className="admin-input h-10 w-full px-3 text-sm"><option>Cozinha</option><option>Quartos</option><option>Banheiros</option></select></FormField><FormField label="Quantidade recomendada"><Input defaultValue={item.quantity}/></FormField></div><div><FieldLabel>Classificação</FieldLabel><div className="mt-2 grid grid-cols-3 gap-2">{(["Essencial","Recomendado","Opcional"] as Classification[]).map(value=><Button type="button" key={value} size="sm" variant={classification===value?"default":"outline"} className="min-w-0 px-2 text-xs" onClick={()=>setClassification(value)}>{value}</Button>)}</div></div><FormField label="Descrição / especificação"><Textarea defaultValue={item.specification} className="min-h-24"/></FormField><FormField label="Dica STAYO"><Textarea defaultValue={item.tip} className="min-h-20"/></FormField><FormField label="Link de indicação de compra"><Input type="url" placeholder="https://" defaultValue={item.reference??""}/></FormField><div className="grid grid-cols-2 gap-2 border-t border-[var(--admin-border)] pt-5"><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button type="submit">Salvar</Button></div><p className="text-center text-xs text-[var(--admin-muted)]">Ação demonstrativa. Nenhum dado real será alterado.</p></form>
}
function FieldLabel({children}:{children:string}){return <span className="text-sm font-semibold">{children}</span>}
function FormField({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><FieldLabel>{label}</FieldLabel><div className="mt-2">{children}</div></label>}
