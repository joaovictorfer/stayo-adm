import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMELINE_STEPS, timelineStatusPatch } from './property-timeline';

describe('etapas de cuidado dos estofados', () => {
  it('inclui limpeza como etapa independente após a limpeza inicial', () => {
    const index = DEFAULT_TIMELINE_STEPS.indexOf('Limpeza inicial');
    expect(DEFAULT_TIMELINE_STEPS[index + 1]).toBe('Limpeza de estofado');
    expect(DEFAULT_TIMELINE_STEPS.filter(title => title === 'Limpeza de estofado')).toHaveLength(1);
  });
  it('inclui blindagem como etapa independente após a limpeza de estofado', () => {
    const index = DEFAULT_TIMELINE_STEPS.indexOf('Limpeza de estofado');
    expect(DEFAULT_TIMELINE_STEPS[index + 1]).toBe('Blindagem de estofado');
    expect(DEFAULT_TIMELINE_STEPS.filter(title => title === 'Blindagem de estofado')).toHaveLength(1);
  });
});

describe('conclusão da linha do tempo', () => {
  it('marca concluído com a data do clique', () => {
    expect(timelineStatusPatch({ done_at: null }, 'concluido', '2026-11-12T21:32:00Z')).toEqual({ status: 'concluido', done_at: '2026-11-12T21:32:00Z' });
  });
  it('mantém a data original de uma etapa já concluída', () => {
    expect(timelineStatusPatch({ done_at: '2026-11-10T12:00:00Z' }, 'concluido', '2026-11-12T21:32:00Z').done_at).toBe('2026-11-10T12:00:00Z');
  });
  it('reabrir remove a data de conclusão sem excluir a etapa', () => {
    expect(timelineStatusPatch({ done_at: '2026-11-10T12:00:00Z' }, 'pendente', '2026-11-12T21:32:00Z')).toEqual({ status: 'pendente', done_at: null });
  });
});