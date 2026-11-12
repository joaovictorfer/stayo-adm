import type { ImplementationProject } from '@/types/core';

export type PropertyOperationalStatus = 'operacao' | 'implantacao' | 'nao_classificado';
export function propertyOperationalStatus(project: Pick<ImplementationProject, 'status' | 'operationalStatus'>): PropertyOperationalStatus {
  return project.operationalStatus ?? (project.status === 'ativo' ? 'operacao' : 'implantacao');
}
export function isPropertyOperating(project: Pick<ImplementationProject, 'status' | 'operationalStatus'>): boolean {
  return propertyOperationalStatus(project) === 'operacao';
}
export function isPropertyImplementing(project: Pick<ImplementationProject, 'status' | 'operationalStatus'>): boolean {
  return propertyOperationalStatus(project) === 'implantacao';
}