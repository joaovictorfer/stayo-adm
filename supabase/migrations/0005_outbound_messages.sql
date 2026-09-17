-- Fase 9: outbox de mensagens de WhatsApp (seção 24 do plano).
--
-- Toda mensagem passa por aqui antes de qualquer tentativa de envio —
-- nunca é disparada direto de uma tela. Enquanto não houver provider real
-- configurado, o status nunca chega a "sent" de verdade: o time usa o
-- link wa.me manualmente (ver src/lib/whatsapp/gateway.ts) e a mensagem
-- fica "queued" até esse provider existir.

create type outbound_message_status as enum ('draft', 'queued', 'sent', 'failed', 'cancelled');

create table outbound_messages (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null,
  owner_id uuid,
  destination text not null,
  template text not null,
  body text not null,
  status outbound_message_status not null default 'draft',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz
);

create index outbound_messages_implementation_idx on outbound_messages (implementation_id);

alter table outbound_messages enable row level security;

create policy "time interno lê outbox"
  on outbound_messages for select
  using (has_admin_role('super_admin', 'admin', 'commercial', 'operations'));

create policy "comercial/admin gerenciam outbox"
  on outbound_messages for all
  using (has_admin_role('super_admin', 'admin', 'commercial'))
  with check (has_admin_role('super_admin', 'admin', 'commercial'));
