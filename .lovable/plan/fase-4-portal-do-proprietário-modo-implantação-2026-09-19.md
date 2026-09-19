# Fase 4 — Portal do Proprietário / modo Implantação

## Objetivo
Transformar o botão **Portal** do workspace em um acesso seguro e administrável, e substituir o formulário isolado por um portal contínuo, mobile-first, limitado ao modo Implantação.

## Implementação

### 1. Acesso seguro no workspace
- Fazer o botão **Portal** abrir um menu/painel claro de gestão do acesso.
- Sem acesso ativo: oferecer **Criar acesso**; gerar token criptograficamente aleatório, longo e não previsível; gravar somente o hash no banco; registrar criação e expiração.
- Após a geração: mostrar o link uma única vez, com **Abrir portal**, **Copiar link** e **Compartilhar** (Web Share API, com fallback para cópia).
- Com acesso ativo e token ainda disponível na sessão administrativa: mostrar **Abrir portal**, **Copiar link**, **Compartilhar**, **Gerar novo link** e **Revogar acesso**.
- Se um acesso antigo existir, mas o token original não estiver disponível, mostrar o estado do acesso e pedir **Gerar novo link**. Isso preserva o desenho atual, no qual o banco guarda apenas o hash e não consegue reconstruir o segredo.
- Gerar novo link revoga os anteriores ativos; revogar invalida imediatamente o acesso público.

### 2. Portal público em modo Implantação
- Reestruturar `/portal/implantacao/:token` como dashboard claro e premium, usando a logo oficial STAYO.
- Cabeçalho com saudação pelo primeiro nome e a mensagem de implantação.
- Mostrar apenas a projeção pública permitida:
  - etapa atual simplificada;
  - progresso dos itens visíveis ao proprietário;
  - previsão disponível;
  - próximos marcos;
  - pendências do proprietário;
  - atualizações públicas derivadas somente de itens `owner_visible`.
- Criar timeline simplificada: **Proposta**, **Planejamento**, **Preparação do imóvel**, **Configuração**, **Validação** e **Pronto para operar**.
- Na seção **Precisamos de você**, incluir somente tarefas vinculadas à implantação e itens de checklist com `owner_visible = true`; não mostrar observações internas.
- Na seção **Proposta**, exibir somente a versão vigente disponível, seu estado e as ações públicas seguras já suportadas (visualização, aceite e PDF/link quando existentes).
- Na seção **Documentos**, exibir somente arquivos explicitamente liberados ao proprietário. Como o modelo atual não possui um campo de liberação pública, nenhum anexo será exposto por token nesta fase; a tela explicará quando não houver documentos liberados, evitando vazamento.
- Manter o cadastro complementar como uma ação dentro do portal, em vez de ser toda a experiência.

### 3. Segurança e dados
- Criar uma leitura pública específica por token no backend, retornando somente campos permitidos; a página pública não consultará tabelas administrativas diretamente.
- Validar no backend: hash do token, expiração e revogação antes de cada leitura.
- Nunca retornar hash/token, UUIDs técnicos, notas internas, logs, credenciais, hóspedes, prestadores ou custos/margens internos.
- Calcular progresso e atualizações públicas exclusivamente a partir de `owner_visible`.
- Manter bucket de documentos privado e URLs temporárias; nenhum arquivo será público sem uma permissão explícita no modelo.
- Adicionar `GRANT`, RLS e funções públicas restritas na mesma migração quando necessário.

### 4. Validação
- Testar no workspace: criar acesso, copiar, compartilhar/fallback, abrir, gerar novo link e revogar.
- Confirmar que o link anterior falha após regeneração e que o link revogado deixa de abrir.
- Validar portal em desktop e mobile, sem rolagem lateral e com contraste claro.
- Verificar que itens não visíveis, notas, identificadores técnicos e demais dados internos não aparecem.
- Executar testes automatizados relevantes e validação de tipos.

## Fora do escopo
- Dashboard do proprietário com imóvel já ativo.
- Alteração do Portal público institucional.
- Exposição de documentos sem uma permissão pública explícita.
- Mudanças nas regras de negócio da implantação.
