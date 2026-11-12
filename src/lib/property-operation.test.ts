import { describe, expect, it } from 'vitest';
import { isPropertyOperating, isPropertyImplementing, propertyOperationalStatus } from './property-operation';

describe('situação operacional independente do cadastro', () => {
  it('não mistura fichas antigas não classificadas com implantação', () => {
    expect(isPropertyImplementing({ status: 'prospect', operationalStatus: 'nao_classificado' })).toBe(false);
  });
  it('B104 permanece em operação com cadastro prospect incompleto', () => {
    expect(isPropertyOperating({ status: 'prospect', operationalStatus: 'operacao' })).toBe(true);
  });
  it('D306 segue em implantação conforme decisão explícita', () => {
    expect(propertyOperationalStatus({ status: 'ativo', operationalStatus: 'implantacao' })).toBe('implantacao');
  });
  it('mantém compatibilidade com fichas ativas anteriores', () => {
    expect(isPropertyOperating({ status: 'ativo' })).toBe(true);
    expect(isPropertyOperating({ status: 'prospect' })).toBe(false);
  });
});