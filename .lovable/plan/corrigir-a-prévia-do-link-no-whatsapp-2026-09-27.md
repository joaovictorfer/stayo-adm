# Corrigir a prévia do link no WhatsApp

## Resultado
- Trocar a miniatura atual da página de login por um cartão próprio da jornada do proprietário.
- Usar a foto autorizada da implantação/condomínio quando existir.
- Usar uma imagem institucional STAYO adequada quando o imóvel ainda não tiver foto.
- Manter título e descrição curtos para leitura correta no WhatsApp.

## Implementação
- Adicionar uma URL pública de imagem que valida o token antes de entregar a capa privada do imóvel.
- Fazer a página `/portal/implantacao/$token` declarar `og:image` e `twitter:image` absolutos, além de `summary_large_image`.
- Preservar o bucket privado e impedir acesso a fotos de outra implantação.
- Usar a imagem institucional existente como fallback sem expor dados do proprietário.

## Validação
- Confirmar no HTML renderizado as tags de título, descrição e imagem.
- Testar imagem com token válido e fallback com token inválido/sem capa.
- Verificar compilação e ausência de regressão na abertura normal do link.

## Observação
A correção aparecerá no domínio público após uma nova publicação. O WhatsApp pode manter uma prévia antiga em cache até consultar novamente o link.
