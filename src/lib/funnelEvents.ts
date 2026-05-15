import { supabase } from "@/integrations/supabase/client";

export type FunnelEventType =
  | "prospect_created"
  | "status_changed"
  | "lead_analyzed"
  | "message_generated"
  | "call_script_generated"
  | "competitors_analyzed"
  | "offer_generated"
  | "invoice_created"
  | "invoice_paid";

interface LogFunnelEventInput {
  event_type: FunnelEventType;
  entity_type: string;
  entity_id?: string | null;
  prospect_id?: string | null;
  client_id?: string | null;
  source?: string | null;
  status_from?: string | null;
  status_to?: string | null;
  channel?: string | null;
  amount?: number | null;
  metadata?: Record<string, unknown>;
}

export async function logFunnelEvent(input: LogFunnelEventInput) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("funnel_events" as never).insert({
    ...input,
    created_by: user?.id ?? null,
    metadata: input.metadata ?? {},
  } as never);

  if (error) {
    console.warn("funnel event skipped", error.message);
  }
}
