import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Copy, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createFieldLink } from '@/lib/field-registration.functions';
export function FieldLinkDialog({ implementationId }: { implementationId?: string }) {
 const create = useServerFn(createFieldLink);
 const [open, setOpen] = useState(false);
 const [url, setUrl] = useState('');
 const [busy, setBusy] = useState(false);
 const generate = async () => {
  setBusy(true);
  try { const result = await create({ data: { implementationId } }); setUrl(`${window.location.origin}/portal/cadastro-vistoria/${result.token}`); }
  catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o link'); }
  finally { setBusy(false); }
 };
 return <><Button variant="outline" onClick={() => setOpen(true)}><Link2 className="size-4" />{implementationId ? 'Cadastro e vistoria' : 'Novo cadastro por link'}</Button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Cadastro e vistoria</DialogTitle></DialogHeader>
 <p className="text-sm text-muted-foreground">Link válido por 30 dias. Quem receber poderá alterar os dados do imóvel e o inventário. Compartilhe somente com o proprietário ou a equipe.</p>
 {!url ? <Button className="h-12" disabled={busy} onClick={() => void generate()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}Gerar link</Button> : <div className="space-y-3"><div className="break-all rounded-lg border bg-muted p-3 text-sm">{url}</div><div className="flex flex-wrap gap-2"><Button className="h-12" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success('Link copiado')).catch(() => toast.error('Não foi possível copiar'))}><Copy className="size-4" />Copiar link</Button><Button asChild variant="outline" className="h-12"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Abrir cadastro</a></Button></div><Button variant="ghost" disabled={busy} onClick={() => void generate()}><RefreshCw className="size-4" />Gerar outro link</Button></div>}
 </DialogContent></Dialog></>;
}
