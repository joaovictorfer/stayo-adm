import { describe, it, expect } from "vitest";
import { chargeDraftSchema } from "./charge-contract";
import { chargeTotals } from "./charge-prototype";
const avulsa = { id:"a0df1c1a-9b57-4120-91c5-5b3b630ba5c5", revision:0, title:"Limpeza",recipient:"Cliente",email:"",ownerId:null,implementationId:null,due:"2026-10-28",competence:"2026-10",notes:"",internalNotes:"",items:[{id:"1",description:"Limpeza",quantity:1,unitCents:25000}] };
describe("Cobrança avulsa real",()=>{
 it("permite destinatário sem imóvel e sem cadastro de proprietário",()=>expect(chargeDraftSchema.safeParse(avulsa).success).toBe(true));
 it("não permite avulsa anônima",()=>expect(chargeDraftSchema.safeParse({...avulsa,recipient:""}).success).toBe(false));
 it("Pix cobra os R$250 integrais",()=>expect(chargeTotals(avulsa.items).pix).toBe(25000));
 it("cartão cobra R$262,50 com acréscimo de 5%",()=>expect(chargeTotals(avulsa.items).card).toBe(26250));
});