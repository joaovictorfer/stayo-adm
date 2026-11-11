## Entrega final

Um relatório em português, organizado em:

- **Corrigido durante a revisão**: erros pequenos e seguros, que eu mesmo ajusto.
- **Ajustes manuais necessários**: o que depende de você (dado faltando numa ficha, credencial, decisão comercial), com o imóvel e o campo exatos.
- **Riscos**: o que pode dar problema, em ordem de prioridade.
- **Sugestões de melhoria**: ideias de uso, visual e controle, em ordem de impacto.

## Cuidados

- Nenhum pagamento real, envio de e-mail ou alteração no financeiro VF.
- Os testes rodam na cópia deste rascunho; os dados de teste não vão para o app.
- Mudanças grandes não serão feitas sem sua aprovação; entram como sugestão.

## Detalhes técnicos

- `bunx vitest run`, `tsgo -b --noEmit` e logs em /tmp/observability.
- Playwright com usuário de teste do rascunho, nos perfis superadmin e sem papel.
- Varredura de segurança padrão e profunda; consultas somente leitura para encontrar lacunas de dados.
