# Fase 5 — QA e limpeza final da jornada guiada

## Estado confirmado

- Branch atual: `edit/edt-f96a7eba-e0ea-4768-87ec-1d27c7056167`; HEAD `922390938f4a25563186acd5ccb70fd4d8389841`; árvore limpa.
- A jornada já contém as cinco etapas, os três blocos da Proposta, Inventário unificado, Fornecedores em lista + detalhe e publicação guiada versionada.
- A Fonte Mestra e o handoff citados não estão disponíveis no projeto nem nos arquivos enviados. A execução seguirá a autorização anterior de prosseguir sem eles, usando as instruções desta fase e as regras consolidadas do projeto.
- Redundâncias comprovadas: resumo duplicado da Proposta na Revisão; retorno ambíguo entre sair, voltar etapa e voltar de módulo; “Continuar editando” retorna sempre ao Contato; títulos internos repetem a etapa; rodapé móvel não considera explicitamente a área segura.
- O menu secundário de exclusão e o estado compacto de salvamento já seguem a direção pedida e serão preservados.

## Implementação

1. **Referência visual antes das correções**
   - Registrar a jornada atual em 390 px, cobrindo Contato, Imóvel, os três blocos da Proposta, Implantação e Revisão.
   - Usar uma oportunidade temporária própria para QA; nunca publicar ou alterar a IMP-00003.

2. **Uma linguagem única de navegação**
   - Uniformizar cabeçalho, título, etapa, progresso, saída e retorno nas cinco etapas.
   - Diferenciar claramente “voltar uma etapa”, “voltar ao menu da Implantação” e “salvar e sair”.
   - Manter exclusão apenas no menu secundário, com a confirmação e permissões atuais.
   - Manter o feedback de autosave compacto, visível somente quando útil ou quando houver erro.

3. **Limpeza sem criar funcionalidades**
   - Remover somente repetições comprovadas de títulos, textos, cards e ações.
   - Preservar o menu compacto da Implantação, pois ele é a entrada necessária para Enxoval, Inventário, Fornecedores e Observações; eliminar apenas retornos ou títulos duplicados dentro desses detalhes.
   - Não alterar domínio, banco, permissões, Portal, snapshots, versionamento ou regras de publicação.

4. **Revisão final consolidada**
   - Exibir Contato com nome e telefone.
   - Exibir Imóvel com identificação curta e uma indicação agregada do que pode ser completado depois.
   - Unificar a Proposta em um único resumo com taxa, limpeza, vigência, aviso e quantidade de condições/serviços.
   - Exibir uma linha curta da Implantação, sem lista extensa de faltas.
   - Manter validações precisas e acesso opcional ao editor avançado.

5. **Mobile e desktop**
   - Ajustar rodapé fixo, área segura, rolagem, campos, seletores, diálogos e drawers para 375×812, 390×844 e 430×932.
   - Verificar o comportamento com teclado virtual e manter o CTA acessível sem cobrir conteúdo.
   - No desktop, manter coluna central controlada e validar a Revisão sem alargar desnecessariamente os campos.

## QA funcional e regressão

- Executar o fluxo real A–H: criação mínima, salvar/sair, retomada, imóvel, proposta, abertura/fechamento dos quatro módulos, revisão, publicação, abertura do link e retorno à implantação.
- Confirmar persistência após cada saída/retomada, autosave, snapshot imutável, link público correto e ausência de envio automático de WhatsApp.
- Cobrir proposta incompleta e válida, Inventário, Fornecedores, permissões e Portal/link.
- Excluir ao final a oportunidade temporária de QA e confirmar que a IMP-00003 permaneceu intacta.
- Rodar testes existentes, testes focados da jornada, typecheck, lint e compilação; registrar separadamente qualquer falha preexistente fora do escopo.

## Evidências e entrega

- Entregar capturas finais de cada macroetapa em 390 px, incluindo os três blocos internos da Proposta, e uma captura desktop da Revisão.
- Comparar antes/depois, listar bugs corrigidos e registrar qualquer quebra arquitetural real que não possa ser removida sem ampliar o escopo.
- Relatar arquivos alterados, migrations (esperadas: nenhuma), testes, riscos, branch, commit, PR e estado do GitHub.
- Não fazer merge, não publicar o app e não iniciar outra fase.
