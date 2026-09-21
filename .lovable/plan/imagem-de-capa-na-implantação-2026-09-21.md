# Imagem de capa na implantação

## Objetivo
Adicionar uma fonte única e previsível para a foto de capa da implantação, sem redesenhar o sistema e sem alterar regras do fluxo operacional.

## Implementação
1. **Modelo e persistência**
   - Acrescentar `cover_image` à implantação no banco e `coverImage` ao contrato usado pela interface.
   - Preservar o adaptador local atual, incluindo o novo campo no cadastro e nas atualizações.
   - Aplicar a alteração de banco sem ampliar permissões existentes.

2. **Resolução centralizada da capa**
   - Criar um resolvedor único com esta prioridade: capa própria da implantação → imagem vinculada aos anexos/documentos da implantação → placeholder institucional.
   - Aceitar somente anexos de imagem no fallback e gerar URL temporária para arquivos privados.
   - Manter o placeholder como asset institucional do projeto para funcionar mesmo sem dados ou conexão com arquivos.

3. **Exibição**
   - Workspace: incluir uma faixa de capa elegante no topo, integrada ao cabeçalho existente, com enquadramento estável e fallback sem quebra de layout.
   - Listagem: mostrar miniatura apenas onde melhora a leitura, preservando densidade e versão mobile.
   - Deixar a ação de anexar/trocar capa visível e preparada para substituição manual, sem expandir o restante do cadastro.

4. **PDF interno**
   - Permitir que o resumo interno receba a imagem resolvida e a use como destaque de capa quando disponível.
   - Se a imagem não puder ser carregada ou incorporada, gerar normalmente com o cabeçalho institucional atual.
   - Manter o PDF comercial intocado e preservar todas as regras de privacidade.

5. **Validação**
   - Cobrir por testes a prioridade dos fallbacks e os casos sem imagem/anexo inválido.
   - Validar Workspace e listagem em desktop/mobile, sem vazamento horizontal.
   - Rodar testes relevantes e build.

## Limites
- Nenhuma mudança no Portal do Proprietário, proposta comercial ou regras da implantação.
- Nenhum dado sensível será exposto; anexos privados continuarão usando URLs temporárias.
