import { getSupabaseBrowserClient } from "./supabase-client";
import type {
  CommercialAssignee,
  CommercialMeetingMode,
  CommercialMeetingState,
  CommercialMeetingStatus,
  CommercialNextActionStatus,
  CommercialOverviewRow,
} from "../../types/commercial-journey";

function client() {
  const value = getSupabaseBrowserClient();
  if (!value) {
    throw new Error(
      "Agenda comercial desconectada. O banco não está configurado; nenhum dado foi simulado.",
    );
  }
  return value;
}

function commandId(): string {
  return crypto.randomUUID();
}

function stateFromRpc(value: unknown): CommercialMeetingState {
  const data = (value ?? {}) as Partial<CommercialMeetingState>;
  return {
    currentMeeting: data.currentMeeting ?? null,
    meetings: Array.isArray(data.meetings) ? data.meetings : [],
    events: Array.isArray(data.events) ? data.events : [],
    nextAction: data.nextAction ?? null,
    actionHistory: Array.isArray(data.actionHistory) ? data.actionHistory : [],
  };
}

export interface ScheduleCommercialMeetingInput {
  implementationId: string;
  startsAtLocal: string;
  timeZone: string;
  mode: CommercialMeetingMode;
  joinUrl?: string | null;
  responsibleUserId: string;
  commandId?: string;
}

export interface RescheduleCommercialMeetingInput extends Omit<
  ScheduleCommercialMeetingInput,
  "implementationId"
> {
  meetingId: string;
  expectedVersion: number;
}

export interface UpdateCommercialMeetingStatusInput {
  meetingId: string;
  expectedVersion: number;
  status: Extract<CommercialMeetingStatus, "confirmed" | "completed" | "cancelled" | "no_show">;
  commandId?: string;
}

export interface SetCommercialNextActionInput {
  implementationId: string;
  title: string;
  dueAtLocal: string;
  timeZone: string;
  responsibleUserId?: string | null;
  commandId?: string;
}

export interface CloseCommercialNextActionInput {
  actionId: string;
  expectedVersion: number;
  status: Extract<CommercialNextActionStatus, "completed" | "cancelled">;
  commandId?: string;
}

export const commercialMeetingsApi = {
  async getState(implementationId: string): Promise<CommercialMeetingState> {
    const { data, error } = await client().rpc("admin_get_commercial_meeting_state", {
      p_implementation_id: implementationId,
    });
    if (error) throw error;
    return stateFromRpc(data);
  },

  async listOverview(): Promise<CommercialOverviewRow[]> {
    const { data, error } = await client().rpc("admin_list_commercial_overview");
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      implementationId: String(row["implementation_id"]),
      meetingStartsAt: (row["meeting_starts_at"] as string | null) ?? null,
      meetingTimeZone: (row["meeting_time_zone"] as string | null) ?? null,
      meetingMode: (row["meeting_mode"] as CommercialMeetingMode | null) ?? null,
      meetingStatus:
        (row["meeting_status"] as CommercialOverviewRow["meetingStatus"] | null) ?? null,
      meetingResponsibleUserId: (row["meeting_responsible_user_id"] as string | null) ?? null,
      meetingResponsibleName: (row["meeting_responsible_name"] as string | null) ?? null,
      nextActionTitle: (row["next_action_title"] as string | null) ?? null,
      nextActionDueAt: (row["next_action_due_at"] as string | null) ?? null,
      nextActionTimeZone: (row["next_action_time_zone"] as string | null) ?? null,
      nextActionResponsibleUserId:
        (row["next_action_responsible_user_id"] as string | null) ?? null,
      nextActionResponsibleName: (row["next_action_responsible_name"] as string | null) ?? null,
    }));
  },

  async listAssignees(): Promise<CommercialAssignee[]> {
    const { data, error } = await client().rpc("admin_list_commercial_assignees");
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row["id"]),
      fullName: String(row["full_name"]),
      role: row["role"] as CommercialAssignee["role"],
    }));
  },

  async schedule(input: ScheduleCommercialMeetingInput): Promise<CommercialMeetingState> {
    const { data, error } = await client().rpc("admin_schedule_commercial_meeting", {
      p_data: {
        implementationId: input.implementationId,
        startsAtLocal: input.startsAtLocal,
        timeZone: input.timeZone,
        mode: input.mode,
        joinUrl: input.joinUrl?.trim() || null,
        responsibleUserId: input.responsibleUserId,
        commandId: input.commandId ?? commandId(),
      },
    });
    if (error) throw error;
    return stateFromRpc(data);
  },

  async reschedule(input: RescheduleCommercialMeetingInput): Promise<CommercialMeetingState> {
    const { data, error } = await client().rpc("admin_reschedule_commercial_meeting", {
      p_data: {
        meetingId: input.meetingId,
        startsAtLocal: input.startsAtLocal,
        timeZone: input.timeZone,
        mode: input.mode,
        joinUrl: input.joinUrl?.trim() || null,
        responsibleUserId: input.responsibleUserId,
        expectedVersion: input.expectedVersion,
        commandId: input.commandId ?? commandId(),
      },
    });
    if (error) throw error;
    return stateFromRpc(data);
  },

  async updateStatus(input: UpdateCommercialMeetingStatusInput): Promise<CommercialMeetingState> {
    const { data, error } = await client().rpc("admin_update_commercial_meeting_status", {
      p_data: {
        meetingId: input.meetingId,
        expectedVersion: input.expectedVersion,
        status: input.status,
        commandId: input.commandId ?? commandId(),
      },
    });
    if (error) throw error;
    return stateFromRpc(data);
  },

  async setNextAction(input: SetCommercialNextActionInput): Promise<CommercialMeetingState> {
    const { data, error } = await client().rpc("admin_set_implementation_next_action", {
      p_data: {
        implementationId: input.implementationId,
        title: input.title,
        dueAtLocal: input.dueAtLocal,
        timeZone: input.timeZone,
        responsibleUserId: input.responsibleUserId ?? null,
        commandId: input.commandId ?? commandId(),
      },
    });
    if (error) throw error;
    return stateFromRpc(data);
  },

  async closeNextAction(input: CloseCommercialNextActionInput): Promise<CommercialMeetingState> {
    const { data, error } = await client().rpc("admin_close_implementation_next_action", {
      p_data: {
        actionId: input.actionId,
        expectedVersion: input.expectedVersion,
        status: input.status,
        commandId: input.commandId ?? commandId(),
      },
    });
    if (error) throw error;
    return stateFromRpc(data);
  },
};
