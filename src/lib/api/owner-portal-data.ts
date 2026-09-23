import { getSupabaseBrowserClient } from "./supabase-client";

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
  suites: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  accessType: "key" | "lock" | "concierge" | "other" | null;
  accessNotes: string | null;
  accessCode: string | null;
  wifiNetwork: string | null;
  wifiPassword: string | null;
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
    suites: (row["suites"] as number | null) ?? null,
    bathrooms: (row["bathrooms"] as number | null) ?? null,
    parkingSpots: (row["parking_spots"] as number | null) ?? null,
    accessType: (row["access_type"] as PropertyDetails["accessType"]) ?? null,
    accessNotes: (row["access_notes"] as string | null) ?? null,
    accessCode: (row["access_code"] as string | null) ?? null,
    wifiNetwork: (row["wifi_network"] as string | null) ?? null,
    wifiPassword: (row["wifi_password"] as string | null) ?? null,
    notes: (row["notes"] as string | null) ?? null,
    updatedAt: String(row["updated_at"]),
  };
}

export async function getPropertyDetails(implementationId: string): Promise<PropertyDetails | null> {
  const { data, error } = await client()
    .from("implementation_property_details")
    .select("*")
    .eq("implementation_id", implementationId)
    .maybeSingle();
  if (error) throw error;
  return data ? detailsFromRow(data as Record<string, unknown>) : null;
}

export async function savePropertyDetails(
  implementationId: string,
  input: PropertyDetailsInput,
): Promise<PropertyDetails> {
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
      bedrooms: input.bedrooms,
      suites: input.suites,
      bathrooms: input.bathrooms,
      parking_spots: input.parkingSpots,
      access_type: input.accessType,
      access_notes: input.accessNotes,
      access_code: input.accessCode,
      wifi_network: input.wifiNetwork,
      wifi_password: input.wifiPassword,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return detailsFromRow(data as Record<string, unknown>);
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
        .order("event_date", { ascending: false }),
      supabase
        .from("implementation_items")
        .select("id,title,description,due_date,status,completed_at")
        .eq("implementation_id", implementationId)
        .eq("owner_visible", true),
      supabase
        .from("proposals")
        .select("id,version,created_at,accepted_at")
        .eq("implementation_id", implementationId),
      supabase
        .from("implementation_inspections")
        .select("id,type,status,scheduled_for,completed_at,public_notes")
        .eq("implementation_id", implementationId),
      supabase
        .from("implementation_projects")
        .select("id,status,start_date_estimate,completion_date_estimate,updated_at")
        .eq("id", implementationId)
        .single(),
    ]);

  const firstError = [updatesResult, itemsResult, proposalsResult, inspectionsResult, projectResult].find(
    (result) => result.error,
  )?.error;
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
  for (const proposal of proposalsResult.data ?? []) {
    events.push({
      id: `proposal-${proposal.id}`,
      title: `Proposta comercial · versão ${proposal.version}`,
      description: proposal.accepted_at ? "Proposta aceita." : "Proposta disponibilizada para análise.",
      date: proposal.accepted_at ?? proposal.created_at,
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