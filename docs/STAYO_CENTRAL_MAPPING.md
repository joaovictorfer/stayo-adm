# Fase 10B.2 — matriz prévia (sem sincronização)

| Entidade | Cadastro atual | Identificador externo conhecido | Correspondência proposta |
| --- | --- | --- | --- |
| Proprietário | `owner_records.id`, contatos e ciclo comercial | `owner_records.core_owner_id` | Igualdade UUID com `/admin/owners/{id}`; nunca nome/e-mail/CPF |
| Imóvel/implantação | `implementation_projects.id`, `code`, cadastro e jornada | `implementation_projects.core_property_id` | Igualdade UUID com `/admin/properties/{id}`; código não é identidade |
| Proprietário da implantação | `owner_id` e `implementation_owners` N:N | `implementation_projects.core_owner_id` | Conferir divergência com `owner_records.core_owner_id`; não corrigir automaticamente |
| Condomínio | `admin_condominiums` | Sem campo externo inequívoco | Sem correspondência automática; V1 não documenta endpoint de condomínios |
| Reserva | Contrato Core, atualmente mock/vazio nas queries | Futuro UUID da API; sem tabela local de reservas nesta auditoria | Leitura operacional futura, sem importação nesta fase |
| Contrato | Propostas/condições/attachments locais; lista Core mock | Referências em proprietários/imóveis da V1 | Referência não prova assinatura, não fornece PDF e não substitui contrato local |
| Portal | Auth local, owner_portal_accounts, vínculos/releases | IDs Core vinculados à implantação | `admin:read` NÃO concede acesso por proprietário; não conectar estas consultas ao Portal |

## Diagnóstico e conflitos

Lovable Cloud é o backend próprio do Admin; o provedor é sistema independente acessado por REST. `queries.ts` usa `createMockCoreApiClient` nos recursos operacionais e adapter Cloud apenas nas implantações. `admin-client.ts` usa cadastros locais reais. O antigo `createCoreApiClient` prevê `/api/core/v1`, contrato distinto da V1 fornecida e não ativado nas queries atuais. Não substituir esse cliente nem ligar as telas existentes nesta fase.

Riscos: múltiplos registros locais apontando ao mesmo UUID; vínculo de proprietário divergente entre ficha e owner_records; tipos Core com campos/endpoints inexistentes na V1 (financeiro, contatos do hóspede, contratos detalhados); relação N:N externa não pode ser reduzida a `ownerId`; IDs de anúncio internos não são IDs Airbnb. Vínculos por nome/código ou comparações cadastrais incompletas são candidatos para revisão, não autorização para fusão.

## Modelo de autoridade proposto — não altera fluxos

- Admin: prospectos, oportunidades, implantação, proposta versionada, condições/percentuais aceitos, permissões/login e liberações do Portal.
- App: dados operacionais oficiais, reservas importadas da Ayrton, cancelamentos e status de Web Check-in. Submissão não é aprovação.
- Após vinculação: manter ID local e UUID externo; alterações locais não atualizam App enquanto não existir API de escrita. Divergências são explícitas e exigem decisão humana.
- Contratos: referências operacionais do App e documentação/proposta local coexistem sem se sobrepor; reconciliação futura requer fonte e versão por campo.
- Financeiro: não acessível por `admin:read`; preservar VF/condições/repasses atuais. Não calcular percentuais a partir de campos não documentados.

## Escritas futuras dependentes de API oficial

POST/PATCH proprietários e imóveis, gerenciamento N:N, criação/versão/vínculo de contrato e percentuais, permissões financeiras e revisão de check-in exigem endpoints autenticados, escopos próprios, idempotência, controle de versão e trilha auditada. Não acessar o banco do App, não usar caminhos alternativos. Não implementar essas escritas agora.