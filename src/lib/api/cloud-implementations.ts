import { getSupabaseBrowserClient } from "./supabase-client";
import type { CoreApiClient, Page } from "./core-client";
import type {
  ImplementationItem,
  ImplementationProject,
  ImplementationStatus,
} from "../../types/core";

type ImplementationApi = CoreApiClient["implementations"];

function client() {
  const value = getSupabaseBrowserClient();
  if (!value) throw new Error("O banco não está disponível.");
  return value;
}

function projectFromRow(row: Record<string, unknown>): ImplementationProject {
  const owner = row["owner_records"] as { name?: string; phone?: string | null } | null;
  return {
    id: String(row["id"]),
    code: String(row["code"]),
    status: row["status"] as ImplementationStatus,
    ownerId: (row["owner_id"] as string | null) ?? null,
    ownerName: owner?.name ?? null,
    ownerPhone: owner?.phone ?? null,
    nickname: (row["nickname"] as string | null) ?? null,
    coverImage: (row["cover_image"] as string | null) ?? null,
    condominiumName: (row["condominium_name"] as string | null) ?? null,
    unit: (row["unit"] as string | null) ?? null,
    address: (row["address"] as string | null) ?? null,
    postalCode: (row["postal_code"] as string | null) ?? null,
    city: (row["city"] as string | null) ?? null,
    propertyType: (row["property_type"] as string | null) ?? null,
    bedrooms: (row["bedrooms"] as number | null) ?? null,
    capacity: (row["capacity"] as number | null) ?? null,
    responsibleUserId: (row["responsible_user_id"] as string | null) ?? null,
    startDateEstimate: (row["start_date_estimate"] as string | null) ?? null,
    completionDateEstimate: (row["completion_date_estimate"] as string | null) ?? null,
    notes: (row["notes"] as string | null) ?? null,
    origin: (row["origin"] as string | null) ?? null,
    corePropertyId: (row["core_property_id"] as string | null) ?? null,
    coreOwnerId: (row["core_owner_id"] as string | null) ?? null,
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}

function itemFromRow(row: Record<string, unknown>): ImplementationItem {
  return {
    id: String(row["id"]),
    implementationId: String(row["implementation_id"]),
    category: String(row["category"]),
    phase: String(row["phase"]),
    title: String(row["title"]),
    description: (row["description"] as string | null) ?? null,
    order: Number(row["display_order"]),
    responsibleUserId: (row["responsible_user_id"] as string | null) ?? null,
    dueDate: (row["due_date"] as string | null) ?? null,
    status: row["status"] as ImplementationItem["status"],
    observation: (row["observation"] as string | null) ?? null,
    mandatory: Boolean(row["mandatory"]),
    blocker: Boolean(row["blocker"]),
    ownerVisible: Boolean(row["owner_visible"]),
    completedAt: (row["completed_at"] as string | null) ?? null,
    completedBy: (row["completed_by"] as string | null) ?? null,
    readinessOverrideReason: (row["readiness_override_reason"] as string | null) ?? null,
    readinessOverrideBy: (row["readiness_override_by"] as string | null) ?? null,
    readinessOverrideAt: (row["readiness_override_at"] as string | null) ?? null,
  };
}

const projectSelection = "*,owner_records(name,phone)";

export function createCloudImplementationApi(): ImplementationApi {
  return {
    list: async (params): Promise<Page<ImplementationProject>> => {
      let query = client()
        .from("implementation_projects")
        .select(projectSelection)
        .order("created_at", { ascending: false });
      if (params?.status) query = query.eq("status", params.status as ImplementationStatus);
      const { data, error } = await query;
      if (error) throw error;
      return { data: (data ?? []).map((row) => projectFromRow(row)), nextCursor: null };
    },
    get: async (id) => {
      const { data, error } = await client()
        .from("implementation_projects")
        .select(projectSelection)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? projectFromRow(data) : null;
    },
    create: async (input) => {
      const { data, error } = await client().rpc("admin_create_implementation", {
        p_data: input as Record<string, unknown>,
      });
      if (error) throw error;
      const created = data as unknown as Record<string, unknown>;
      const owner = input.ownerId
        ? await client()
            .from("owner_records")
            .select("name,phone")
            .eq("id", input.ownerId)
            .maybeSingle()
        : null;
      return projectFromRow({ ...created, owner_records: owner?.data ?? null });
    },
    update: async (id, patch) => {
      const row = {
        status: patch.status,
        owner_id: patch.ownerId,
        nickname: patch.nickname,
        cover_image: patch.coverImage,
        condominium_name: patch.condominiumName,
        unit: patch.unit,
        address: patch.address,
        postal_code: patch.postalCode,
        city: patch.city,
        property_type: patch.propertyType,
        bedrooms: patch.bedrooms,
        capacity: patch.capacity,
        responsible_user_id: patch.responsibleUserId,
        start_date_estimate: patch.startDateEstimate,
        completion_date_estimate: patch.completionDateEstimate,
        notes: patch.notes,
        origin: patch.origin,
        core_property_id: patch.corePropertyId,
        core_owner_id: patch.coreOwnerId,
      };
      const clean = Object.fromEntries(
        Object.entries(row).filter(([, value]) => value !== undefined),
      );
      const { data, error } = await client()
        .from("implementation_projects")
        .update(clean)
        .eq("id", id)
        .select(projectSelection)
        .single();
      if (error) throw error;
      return projectFromRow(data);
    },
    items: async (implementationId) => {
      const { data, error } = await client()
        .from("implementation_items")
        .select("*")
        .eq("implementation_id", implementationId)
        .order("display_order");
      if (error) throw error;
      return (data ?? []).map((row) => itemFromRow(row));
    },
    generateChecklist: async (implementationId) => {
      const current = await createCloudImplementationApi().items(implementationId);
      if (current.length > 0) return current;
      const { data: templates, error } = await client()
        .from("checklist_templates")
        .select("*")
        .order("display_order");
      if (error) throw error;
      if (!templates?.length) return [];
      const { data, error: insertError } = await client()
        .from("implementation_items")
        .insert(
          templates.map((template) => ({
            implementation_id: implementationId,
            category: template.category,
            phase: template.phase,
            title: template.title,
            description: template.description,
            display_order: template.display_order,
            mandatory: template.mandatory,
            blocker: template.blocker,
            owner_visible: template.owner_visible,
          })),
        )
        .select("*");
      if (insertError) throw insertError;
      return (data ?? []).map((row) => itemFromRow(row));
    },
    updateChecklistItem: async (itemId, patch) => {
      const row = {
        category: patch.category,
        phase: patch.phase,
        title: patch.title,
        description: patch.description,
        display_order: patch.order,
        responsible_user_id: patch.responsibleUserId,
        due_date: patch.dueDate,
        status: patch.status,
        observation: patch.observation,
        mandatory: patch.mandatory,
        blocker: patch.blocker,
        owner_visible: patch.ownerVisible,
        completed_at: patch.completedAt,
        completed_by: patch.completedBy,
        readiness_override_reason: patch.readinessOverrideReason,
        readiness_override_by: patch.readinessOverrideBy,
        readiness_override_at: patch.readinessOverrideAt,
      };
      const clean = Object.fromEntries(
        Object.entries(row).filter(([, value]) => value !== undefined),
      );
      const { data, error } = await client()
        .from("implementation_items")
        .update(clean)
        .eq("id", itemId)
        .select("*")
        .single();
      if (error) throw error;
      return itemFromRow(data);
    },
  };
}
