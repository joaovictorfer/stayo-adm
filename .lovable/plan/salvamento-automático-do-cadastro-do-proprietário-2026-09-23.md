# Salvamento automático do cadastro do proprietário

## Resultado
- Salvar o rascunho automaticamente poucos instantes após cada alteração, sem exigir o botão “Salvar”.
- Fazer uma última tentativa de gravação quando a pessoa trocar de etapa, sair da página ou ocultar a aba.
- Manter o envio final separado: até confirmar, os dados permanecem como cadastro em andamento; após confirmar, passam a cadastro recebido.
- Exibir um estado discreto no formulário: “Salvando…”, “Alterações salvas” ou “Não foi possível salvar”.

## Ficha administrativa
- Usar o rascunho já persistido como fonte da aba Proprietário da implantação e da ficha do proprietário.
- Atualizar os dados em aberto automaticamente em intervalos curtos, inclusive quando a ficha estiver aberta em outro dispositivo.
- Identificar visualmente dados ainda não enviados como “Cadastro em andamento”, sem tratá-los como definitivos.
- Refletir nome, contato, endereço, pessoas adicionais e repasse conforme o proprietário preenche ou corrige.

## Detalhes técnicos
- O autosave aceitará formulários parciais; a validação completa continuará obrigatória apenas no envio final.
- Aplicar debounce e serialização das gravações para impedir que uma resposta antiga sobrescreva uma edição mais recente.
- Reaproveitar as funções de rascunho e as regras de token, expiração, revogação e privacidade existentes.
- Não criar uma segunda fonte de dados nem alterar reservas, propostas, financeiro global, Core ou autenticação.
- Validar retomada após recarregar, saída da tela, alterações rápidas, envio final e atualização das fichas em desktop e mobile.
