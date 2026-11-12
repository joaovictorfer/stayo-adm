import { supabase } from '@/integrations/supabase/client';
import { timelineStatusPatch, type PropertyTimelineStep, type TimelineStatus } from '../property-timeline';

export async function readPropertyTimeline(implementationId: string): Promise<PropertyTimelineStep[]> {
  const { data, error } = await supabase.from('implementation_timeline_steps').select('id,title,position,done_at,status,notes').eq('implementation_id', implementationId).order('position');
  if (error) throw error;
  return data as PropertyTimelineStep[];
}

export async function updatePropertyTimeline(implementationId: string, step: PropertyTimelineStep, status: TimelineStatus) {
  const { data, error } = await supabase.from('implementation_timeline_steps').update(timelineStatusPatch(step, status, new Date().toISOString())).eq('id', step.id).eq('implementation_id', implementationId).eq('status', step.status).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Esta etapa foi alterada ou não pode ser editada. Atualize a linha do tempo.');
}