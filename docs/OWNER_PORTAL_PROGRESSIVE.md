# Portal progressivo do proprietário

O Portal do Proprietário é um único produto e mantém o mesmo link seguro durante todo o ciclo do imóvel. O estágio é derivado do estado atual da implantação e do vínculo com o imóvel oficial.

## Estados

1. **Implantação** — todos os estados anteriores a `pronto_para_operacao`. Libera Visão geral, Minha implantação, Meus dados, Proposta e Documentos.
2. **Pronto para operação** — `pronto_para_operacao`, ou `ativo` sem `corePropertyId`. Mostra a experiência de transição e os próximos passos, mas não libera dados operacionais sem conversão oficial.
3. **Imóvel ativo** — exige simultaneamente status `ativo` e `corePropertyId`. Libera Visão geral, Reservas, Calendário, Meu imóvel, Vistorias, Manutenções, Financeiro e Documentos.

## Gates

- Reservas, calendário, imóvel, vistorias, manutenções e financeiro só existem no menu ativo quando há vínculo oficial (`corePropertyId`).
- O status `ativo` isolado não é suficiente; nesse caso, o portal permanece na transição.
- Os módulos operacionais recebem projeções públicas mínimas, distintas dos tipos internos.
- Dados ainda não fornecidos pelo Core aparecem como estados vazios honestos.

## Continuidade e segurança

O convite, o token hash, o onboarding, a proposta e o histórico permanecem na mesma linha de acesso. A resolução pública atualiza apenas os campos de ciclo de vida a partir da implantação; não substitui o snapshot histórico.

As projeções públicas nunca incluem documentos ou selfies de hóspedes, conversas privadas, notas internas, credenciais, dados de prestadores, custos ou margens internas. O financeiro é consumidor de dados oficiais; não recalcula nem duplica o sistema financeiro.