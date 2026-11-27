import { getSupabaseBrowserClient } from "./supabase-client";
import { suiteCount } from "../amenities";
import type { ImplementationProject, ImplementationStatus } from "../../types/core";

export interface PropertyDetails {
  implementationId: string;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  parkingBox?: string | null;
  lavatories?: number | null;
  suites: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  accessType: "key" | "lock" | "concierge" | "other" | null;
  accessNotes: string | null;
  accessCode: string | null;
  wifiNetwork: string | null;
  wifiPassword: string | null;
  installerFurniture?: string | null;
  installerHeater?: string | null;
  installerAc?: string | null;
  notes: string | null;
  updatedAt: string;
}

export type PropertyDetailsInput = Omit<PropertyDetails, "implementationId" | "updatedAt">;

export interface PortalTimelineEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  kind: "update" | "budget" | "stage" | "forecast" | "inspection" | "document";
  source: "automatic" | "team";
}

export interface PortalInspection {
  id: string;
  implementationId: string;
  type: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledFor: string | null;
  completedAt: string | null;
  publicNotes: string | null;
}

function client() {
  const value = getSupabaseBrowserClient();
  if (!value) throw new Error("Portal indisponível");
  return value;
}

export async function listOwnerImplementations(): Promise<ImplementationProject[]> {
  const { data, error } = await client()
    .from("implementation_projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status as ImplementationStatus,
    ownerId: row.owner_id,
    ownerName: null,
    ownerPhone: null,
    nickname: row.nickname,
    condominiumName: row.condominium_name,
    unit: row.unit,
    address: row.address,
    postalCode: row.postal_code,
    city: row.city,
    propertyType: row.property_type,
    bedrooms: row.bedrooms,
    capacity: row.capacity,
    responsibleUserId: row.responsible_user_id,
    startDateEstimate: row.start_date_estimate,
    completionDateEstimate: row.completion_date_estimate,
    notes: row.notes,
    origin: row.origin,
    corePropertyId: row.core_property_id,
    coreOwnerId: row.core_owner_id,
    coverImage: row.cover_image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function detailsFromRow(row: Record<string, unknown>): PropertyDetails {
  return {
    implementationId: String(row["implementation_id"]),
    postalCode: (row["postal_code"] as string | null) ?? null,
    street: (row["street"] as string | null) ?? null,
    number: (row["number"] as string | null) ?? null,
    complement: (row["complement"] as string | null) ?? null,
    district: (row["district"] as string | null) ?? null,
    city: (row["city"] as string | null) ?? null,
    state: (row["state"] as string | null) ?? null,
    propertyType: (row["property_type"] as string | null) ?? null,
    bedrooms: (row["bedrooms"] as number | null) ?? null,
    parkingBox: (row["parking_box"] as string | null) ?? null,
    lavatories: (row["lavatories"] as number | null) ?? null,
    suites: (row["suites"] as number | null) ?? null,
    bathrooms: (row["bathrooms"] as number | null) ?? null,
    parkingSpots: (row["parking_spots"] as number | null) ?? null,
    accessType: (row["access_type"] as PropertyDetails["accessType"]) ?? null,
    accessNotes: (row["access_notes"] as string | null) ?? null,
    accessCode: (row["access_code"] as string | null) ?? null,
    wifiNetwork: (row["wifi_network"] as string | null) ?? null,
    wifiPassword: (row["wifi_password"] as string | null) ?? null,
    installerFurniture: (row["installer_furniture"] as string | null) ?? null,
    installerHeater: (row["installer_heater"] as string | null) ?? null,
    installerAc: (row["installer_ac"] as string | null) ?? null,
    notes: (row["notes"] as string | null) ?? null,
    updatedAt: String(row["updated_at"]),
  };
}

export async function getPropertyDetails(
  implementationId: string,
): Promise<PropertyDetails | null> {
  const { data, error } = await client()
    .from("implementation_property_details")
    .select("*")
    .eq("implementation_id", implementationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const project = await client().from("implementation_projects").select("bedrooms").eq("id", implementationId).single();
  if (project.error) throw project.error;
  const amenities = await client().from("implementation_amenities").select("data").eq("implementation_id", implementationId).maybeSingle();
  if (amenities.error) throw amenities.error;
  return { ...detailsFromRow(data as Record<string, unknown>), bedrooms: project.data.bedrooms, suites: suiteCount(amenities.data?.data, data.suites) };
}

export async function savePropertyDetails(
  implementationId: string,
  input: PropertyDetailsInput,
): Promise<PropertyDetails> {
  const project = await client().from("implementation_projects").select("bedrooms").eq("id", implementationId).single();
  if (project.error) throw project.error;
  if (project.data.bedrooms !== input.bedrooms) {
    const changed = await client().from("implementation_projects").update({ bedrooms: input.bedrooms }).eq("id", implementationId);
    if (changed.error) throw changed.error;
  }
  const { data, error } = await client()
    .from("implementation_property_details")
    .upsert({
      implementation_id: implementationId,
      postal_code: input.postalCode,
      street: input.street,
      number: input.number,
      complement: input.complement,
      district: input.district,
      city: input.city,
      state: input.state,
      property_type: input.propertyType,
      suites: input.suites,
      bathrooms: input.bathrooms,
      parking_spots: input.parkingSpots,
      ...(input.parkingBox !== undefined ? { parking_box: input.parkingBox } : {}),
      ...(input.lavatories !== undefined ? { lavatories: input.lavatories } : {}),
      access_type: input.accessType,
      access_notes: input.accessNotes,
      access_code: input.accessCode,
      wifi_network: input.wifiNetwork,
      wifi_password: input.wifiPassword,
      ...(input.installerFurniture !== undefined ? { installer_furniture: input.installerFurniture } : {}),
      ...(input.installerHeater !== undefined ? { installer_heater: input.installerHeater } : {}),
      ...(input.installerAc !== undefined ? { installer_ac: input.installerAc } : {}),
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ...detailsFromRow(data as Record<string, unknown>), bedrooms: input.bedrooms };
}

export async function listPortalInspections(implementationId: string): Promise<PortalInspection[]> {
  const { data, error } = await client()
    .from("implementation_inspections")
    .select("id,implementation_id,type,status,scheduled_for,completed_at,public_notes")
    .eq("implementation_id", implementationId)
    .order("scheduled_for", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    implementationId: row.implementation_id,
    type: row.type,
    status: row.status as PortalInspection["status"],
    scheduledFor: row.scheduled_for,
    completedAt: row.completed_at,
    publicNotes: row.public_notes,
  }));
}

export async function listPortalTimeline(implementationId: string): Promise<PortalTimelineEvent[]> {
  const supabase = client();
  const [updatesResult, itemsResult, proposalsResult, inspectionsResult, projectResult] =
    await Promise.all([
      supabase
        .from("implementation_timeline_updates")
        .select("id,title,description,event_date,kind")
        .eq("implementation_id", implementationId)
        .eq("owner_visible", true)
        .order("event_date", { ascending: false }),
      supabase
        .from("implementation_items")
        .select("id,title,description,due_date,status,completed_at")
        .eq("implementation_id", implementationId)
        .eq("owner_visible", true),
      supabase
        .from("portal_visibility_releases")
        .select("id,released_at,content")
        .eq("implementation_id", implementationId)
        .eq("block", "proposal")
        .is("revoked_at", null),
      supabase
        .from("implementation_inspections")
        .select("id,type,status,scheduled_for,completed_at,public_notes")
        .eq("implementation_id", implementationId)
        .eq("owner_visible", true),
      supabase
        .from("implementation_projects")
        .select("id,status,start_date_estimate,completion_date_estimate,updated_at")
        .eq("id", implementationId)
        .single(),
    ]);

  const firstError = [
    updatesResult,
    itemsResult,
    proposalsResult,
    inspectionsResult,
    projectResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const events: PortalTimelineEvent[] = (updatesResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.event_date,
    kind: row.kind as PortalTimelineEvent["kind"],
    source: "team",
  }));
  for (const item of itemsResult.data ?? []) {
    const date = item.completed_at ?? item.due_date;
    if (!date) continue;
    events.push({
      id: `item-${item.id}-${item.status}`,
      title: item.status === "concluido" ? `${item.title} concluído` : item.title,
      description: item.description,
      date,
      kind: item.status === "concluido" ? "stage" : "forecast",
      source: "automatic",
    });
  }
  for (const release of proposalsResult.data ?? []) {
    const version = (release.content as { snapshot?: { version?: number } } | null)?.snapshot
      ?.version;
    events.push({
      id: `proposal-${release.id}`,
      title: `Proposta comercial${version ? ` · versão ${version}` : ""}`,
      description: "Proposta liberada para você na aba Proposta.",
      date: release.released_at,
      kind: "budget",
      source: "automatic",
    });
  }
  for (const inspection of inspectionsResult.data ?? []) {
    const date = inspection.completed_at ?? inspection.scheduled_for;
    if (!date) continue;
    events.push({
      id: `inspection-${inspection.id}-${inspection.status}`,
      title: inspection.status === "completed" ? "Vistoria concluída" : "Vistoria programada",
      description: inspection.public_notes,
      date,
      kind: "inspection",
      source: "automatic",
    });
  }
  const project = projectResult.data;
  if (project?.start_date_estimate) {
    events.push({
      id: `project-start-${project.id}`,
      title: "Início previsto da implantação",
      description: "Previsão organizada pela equipe Stayo.",
      date: project.start_date_estimate,
      kind: "forecast",
      source: "automatic",
    });
  }
  if (project?.completion_date_estimate) {
    events.push({
      id: `project-finish-${project.id}`,
      title: "Previsão de conclusão",
      description: "Esta previsão pode ser atualizada conforme o andamento do imóvel.",
      date: project.completion_date_estimate,
      kind: "forecast",
      source: "automatic",
    });
  }
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createTimelineUpdate(input: {
  implementationId: string;
  title: string;
  description: string;
  kind: PortalTimelineEvent["kind"];
  ownerVisible: boolean;
}): Promise<void> {
  const { error } = await client()
    .from("implementation_timeline_updates")
    .insert({
      implementation_id: input.implementationId,
      title: input.title,
      description: input.description || null,
      kind: input.kind,
      owner_visible: input.ownerVisible,
    });
  if (error) throw error;
}

export async function createInspection(input: {
  implementationId: string;
  type: string;
  scheduledFor: string | null;
  publicNotes: string;
  ownerVisible: boolean;
}): Promise<void> {
  const { error } = await client()
    .from("implementation_inspections")
    .insert({
      implementation_id: input.implementationId,
      type: input.type,
      scheduled_for: input.scheduledFor,
      public_notes: input.publicNotes || null,
      owner_visible: input.ownerVisible,
    });
  if (error) throw error;
}
