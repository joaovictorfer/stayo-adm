import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, LoaderCircle, MapPin, Pencil, Search, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";

import { adminApi, ownerOnboardingDraftQuery } from "../../lib/api/queries";
import { formatBrazilPhone } from "../../lib/phone";
import { formatPostalCode, formatTaxId, isStepValid, onlyDigits } from "../../lib/owner-onboarding-validation";
import { postalCodeService } from "../../lib/services/postal-code";
import type { OwnerOnboardingDraft, PixKeyType } from "../../types/owner-onboarding";
import type { OwnerPortalSnapshot } from "../../types/owner-portal";
import { Button } from "../ui/button";

const banks = ["Banco do Brasil", "Caixa Econômica Federal", "Bradesco", "Itaú Unibanco", "Santander", "Nubank", "Banco Inter", "Sicredi", "Sicoob", "BTG Pactual", "C6 Bank"];
const labels = ["Identificação", "Contato", "Endereço", "Dados para repasse", "Revisão"];

function blankDraft(snapshot: OwnerPortalSnapshot): OwnerOnboardingDraft {
  return { personType: null, legalName: snapshot.ownerName ?? "", tradeName: "", taxId: "", email: snapshot.ownerEmail ?? "", phone: snapshot.ownerPhone ?? "", postalCode: "", street: "", number: "", complement: "", district: "", city: "", state: "", currentStep: 1, submittedAt: null, bankName: "", accountHolder: snapshot.ownerName ?? "", holderTaxId: "", pixType: null, pixKey: "", isPrimary: true, confirmed: false };
}

function restoreDraft(saved: OwnerOnboardingDraft, snapshot: OwnerPortalSnapshot): OwnerOnboardingDraft {
  const fallback = blankDraft(snapshot);
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const savedValue = saved[key as keyof OwnerOnboardingDraft];
      return [key, savedValue === null || savedValue === undefined ? fallbackValue : savedValue];
    }),
  ) as unknown as OwnerOnboardingDraft;
}

export function OwnerOnboardingFlow({ token, snapshot }: { token: string; snapshot: OwnerPortalSnapshot }) {
  const queryClient = useQueryClient();
  const query = useQuery(ownerOnboardingDraftQuery(token));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OwnerOnboardingDraft>(() => blankDraft(snapshot));
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) {
      setDraft({ ...restoreDraft(query.data, snapshot), confirmed: false });
      setStep(Math.min(5, Math.max(1, query.data.currentStep || 1)));
    }
  }, [query.data, snapshot]);

  const save = useMutation({
    mutationFn: ({ next, submit }: { next: number; submit?: boolean }) => adminApi.ownerOnboarding.saveDraft(token, { ...draft, currentStep: next }, submit),
    onSuccess: async (saved, variables) => {
      setDraft((current) => ({ ...current, ...saved }));
      setStep(variables.next);
      setMessage(variables.submit ? null : "Progresso salvo.");
      await queryClient.invalidateQueries({ queryKey: ["owner-onboarding", "draft", token] });
    },
  });

  if (query.isPending) return <div className="h-20 animate-pulse rounded-md bg-muted" />;
  if (draft.submittedAt) return <Received />;

  return (
    <>
      <div className="rounded-md border border-premium/40 bg-premium-soft p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-semibold text-foreground">Complete seus dados</p><p className="mt-1 text-sm text-muted-foreground">Preencha aos poucos. Seu progresso fica salvo neste acesso.</p></div>
          <span className="shrink-0 rounded-full bg-card px-2 py-1 text-xs font-semibold text-brand">{query.data ? `Etapa ${step}/5` : "Pendente"}</span>
        </div>
        <Button className="mt-4" onClick={() => setOpen(true)}>{query.data ? "Continuar cadastro" : "Começar"}<ChevronRight /></Button>
      </div>

      {open ? <div className="fixed inset-0 z-50 flex bg-foreground/35 sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-label="Cadastro do proprietário">
        <div className="flex h-full w-full flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-lg sm:border sm:border-border sm:shadow-2xl">
          <header className="flex items-start justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
            <div><p className="text-xs font-semibold uppercase text-premium">Cadastro do proprietário</p><h2 className="mt-1 text-xl font-semibold text-foreground">{labels[step - 1]}</h2><p className="mt-1 text-sm text-muted-foreground">Etapa {step} de 5</p></div>
            <Button variant="ghost" size="icon" aria-label="Salvar e sair" onClick={() => save.mutate({ next: step }, { onSuccess: () => setOpen(false) })}><X /></Button>
          </header>
          <div className="grid grid-cols-5 gap-1 bg-card px-4 pb-4 sm:px-6">{labels.map((label, index) => <span key={label} className={`h-1 rounded-full ${index < step ? "bg-brand" : "bg-border"}`} />)}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{step === 1 ? <Identity draft={draft} setDraft={setDraft} /> : step === 2 ? <Contact draft={draft} setDraft={setDraft} /> : step === 3 ? <Address draft={draft} setDraft={setDraft} /> : step === 4 ? <Payout draft={draft} setDraft={setDraft} /> : <Review draft={draft} setDraft={setDraft} />}{message ? <p role="status" className="mt-4 text-sm text-green-700">{message}</p> : null}{save.isError ? <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível salvar. Confira os dados e tente novamente.</p> : null}</div>
          <footer className="flex gap-2 border-t border-border bg-card px-4 py-4 sm:px-6">
            {step > 1 ? <Button variant="outline" onClick={() => setStep((value) => value - 1)}><ArrowLeft />Voltar</Button> : null}
            <Button className="ml-auto" disabled={!isStepValid(step, draft) || save.isPending} onClick={() => save.mutate({ next: step === 5 ? 5 : step + 1, submit: step === 5 })}>{save.isPending ? <LoaderCircle className="animate-spin" /> : step === 5 ? <Check /> : null}{step === 5 ? "Enviar cadastro" : "Salvar e continuar"}</Button>
          </footer>
        </div>
      </div> : null}
    </>
  );
}

const field = "mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground";
const label = "block text-xs font-semibold text-muted-foreground";
type Setter = Dispatch<SetStateAction<OwnerOnboardingDraft>>;
const change = (setDraft: Setter, key: keyof OwnerOnboardingDraft, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));

function Identity({ draft, setDraft }: { draft: OwnerOnboardingDraft; setDraft: Setter }) {
  return <div className="space-y-5"><div className="grid grid-cols-2 gap-2">{(["pf", "pj"] as const).map((type) => <Button key={type} variant={draft.personType === type ? "default" : "outline"} onClick={() => { change(setDraft, "personType", type); change(setDraft, "taxId", ""); }}>{type === "pf" ? "Pessoa física" : "Pessoa jurídica"}</Button>)}</div>{draft.personType ? <><label className={label}>{draft.personType === "pf" ? "Nome completo" : "Razão social"}<input className={field} value={draft.legalName} maxLength={160} onChange={(e) => change(setDraft, "legalName", e.target.value)} /></label>{draft.personType === "pj" ? <label className={label}>Nome fantasia<input className={field} value={draft.tradeName} maxLength={160} onChange={(e) => change(setDraft, "tradeName", e.target.value)} /></label> : null}<label className={label}>{draft.personType === "pf" ? "CPF" : "CNPJ"}<input inputMode="numeric" className={field} value={formatTaxId(draft.taxId, draft.personType)} onChange={(e) => change(setDraft, "taxId", onlyDigits(e.target.value))} /></label></> : <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Selecione o tipo de cadastro para continuar.</p>}</div>;
}

function Contact({ draft, setDraft }: { draft: OwnerOnboardingDraft; setDraft: Setter }) {
  return <div className="space-y-4"><label className={label}>E-mail<input type="email" autoComplete="email" className={field} value={draft.email} maxLength={255} onChange={(e) => change(setDraft, "email", e.target.value)} /></label><label className={label}>Telefone / WhatsApp<input type="tel" autoComplete="tel" inputMode="tel" className={field} value={formatBrazilPhone(draft.phone)} onChange={(e) => change(setDraft, "phone", e.target.value)} /></label><p className="text-xs text-muted-foreground">Você pode corrigir os dados preenchidos pela equipe Stayo.</p></div>;
}

function Address({ draft, setDraft }: { draft: OwnerOnboardingDraft; setDraft: Setter }) {
  const [loading, setLoading] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const lookup = async () => { setLoading(true); setNotice(null); try { const found = await postalCodeService.lookup(draft.postalCode); if (found) setDraft((current) => ({ ...current, postalCode: found.postalCode, street: found.street ?? current.street, district: found.district ?? current.district, city: found.city ?? current.city, state: found.state ?? current.state })); else setNotice("CEP não encontrado. Preencha o endereço manualmente."); } catch { setNotice("A busca não respondeu. Preencha o endereço manualmente."); } finally { setLoading(false); } };
  return <div className="grid gap-4 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>CEP<div className="mt-1 flex gap-2"><input inputMode="numeric" className={`${field} mt-0`} value={formatPostalCode(draft.postalCode)} onChange={(e) => change(setDraft, "postalCode", onlyDigits(e.target.value))} /><Button variant="outline" disabled={onlyDigits(draft.postalCode).length !== 8 || loading} onClick={() => void lookup()}>{loading ? <LoaderCircle className="animate-spin" /> : <Search />}Buscar</Button></div>{notice ? <span className="mt-2 block text-xs text-amber-700">{notice}</span> : null}</label><label className={`${label} sm:col-span-2`}>Rua<input className={field} value={draft.street} maxLength={160} onChange={(e) => change(setDraft, "street", e.target.value)} /></label><label className={label}>Número<input className={field} value={draft.number} maxLength={20} onChange={(e) => change(setDraft, "number", e.target.value)} /></label><label className={label}>Complemento<input className={field} value={draft.complement} maxLength={100} onChange={(e) => change(setDraft, "complement", e.target.value)} /></label><label className={label}>Bairro<input className={field} value={draft.district} maxLength={100} onChange={(e) => change(setDraft, "district", e.target.value)} /></label><label className={label}>Cidade<input className={field} value={draft.city} maxLength={100} onChange={(e) => change(setDraft, "city", e.target.value)} /></label><label className={label}>UF<input className={field} value={draft.state} maxLength={2} onChange={(e) => change(setDraft, "state", e.target.value.toUpperCase())} /></label></div>;
}

function Payout({ draft, setDraft }: { draft: OwnerOnboardingDraft; setDraft: Setter }) {
  const suggestion = useMemo(() => draft.pixType === "cpf" && draft.personType === "pf" ? draft.taxId : draft.pixType === "cnpj" && draft.personType === "pj" ? draft.taxId : draft.pixType === "phone" ? draft.phone : draft.pixType === "email" ? draft.email : "", [draft]);
  const setPixType = (type: PixKeyType) => setDraft((current) => ({ ...current, pixType: type, pixKey: "" }));
  return <div className="space-y-4"><label className={label}>Banco<div className="relative"><input list="stayo-banks" className={field} value={draft.bankName} maxLength={120} placeholder="Pesquise ou digite o banco" onChange={(e) => change(setDraft, "bankName", e.target.value)} /><Search className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-muted-foreground" /></div><datalist id="stayo-banks">{banks.map((bank) => <option key={bank} value={bank} />)}</datalist></label><label className={label}>Titular da conta<input className={field} value={draft.accountHolder} maxLength={160} onChange={(e) => change(setDraft, "accountHolder", e.target.value)} /></label><label className={label}>CPF/CNPJ do titular<input inputMode="numeric" className={field} value={formatTaxId(draft.holderTaxId, onlyDigits(draft.holderTaxId).length > 11 ? "pj" : "pf")} onChange={(e) => change(setDraft, "holderTaxId", onlyDigits(e.target.value).slice(0, 14))} /></label><fieldset><legend className={label}>Tipo de chave PIX</legend><div className="mt-2 flex flex-wrap gap-2">{([['cpf','CPF'],['cnpj','CNPJ'],['phone','Telefone'],['email','E-mail'],['random','Chave aleatória']] as const).map(([value, text]) => <Button size="sm" key={value} variant={draft.pixType === value ? "default" : "outline"} onClick={() => setPixType(value)}>{text}</Button>)}</div></fieldset>{draft.pixType ? <label className={label}>Chave PIX<input className={field} value={draft.pixKey} maxLength={255} onChange={(e) => change(setDraft, "pixKey", e.target.value)} />{suggestion ? <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Usar o dado cadastrado? <Button size="sm" variant="outline" onClick={() => change(setDraft, "pixKey", suggestion)}>Usar sugestão</Button><span>ou digite outro acima.</span></span> : null}</label> : null}<label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"><input type="checkbox" checked={draft.isPrimary} onChange={(e) => change(setDraft, "isPrimary", e.target.checked)} />Conta principal para repasses</label></div>;
}

function Review({ draft, setDraft }: { draft: OwnerOnboardingDraft; setDraft: Setter }) {
  const rows = [["Cadastro", draft.personType === "pf" ? "Pessoa física" : "Pessoa jurídica"], ["Nome", draft.legalName], ["Contato", `${draft.email} · ${formatBrazilPhone(draft.phone)}`], ["Endereço", `${draft.street}, ${draft.number} · ${draft.city}/${draft.state}`], ["Repasse", `${draft.bankName} · PIX ${draft.pixType?.toUpperCase()}`]];
  return <div className="space-y-4"><div className="divide-y divide-border rounded-md border border-border bg-card">{rows.map(([name, value]) => <div key={name} className="flex gap-4 p-3 text-sm"><span className="w-20 shrink-0 text-muted-foreground">{name}</span><span className="min-w-0 break-words font-medium text-foreground">{value}</span></div>)}</div><label className="flex items-start gap-3 rounded-md border border-premium/40 bg-premium-soft p-4 text-sm"><input className="mt-1" type="checkbox" checked={draft.confirmed} onChange={(e) => change(setDraft, "confirmed", e.target.checked)} /><span>Confirmo que revisei os dados e autorizo o envio para validação pela equipe Stayo.</span></label></div>;
}

function Received() { return <div className="rounded-md border border-green-200 bg-green-50 p-5"><div className="flex items-center gap-2 font-semibold text-green-800"><Check />Cadastro recebido</div><p className="mt-2 text-sm text-green-800">Seus dados foram enviados para validação pela equipe Stayo.</p></div>; }