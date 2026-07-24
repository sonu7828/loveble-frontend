import { supabase } from "@/integrations/supabase/client";

export type PhiResourceType =
  | "chart_note"
  | "gfe"
  | "consent"
  | "clinical_photo"
  | "client_id"
  | "client_profile"
  | "appointment";

export type PhiAction = "view" | "download" | "print" | "export";

/**
 * Records a PHI access event. Fire-and-forget — never blocks the UI.
 * Required by HIPAA §164.312(b) — audit controls.
 */
export function logPhiAccess(opts: {
  resourceType: PhiResourceType;
  resourceId?: string | null;
  clientEmail?: string | null;
  action?: PhiAction;
  metadata?: Record<string, unknown>;
}): void {
  try {
    const route = typeof window !== "undefined" ? window.location.pathname : null;
    void (supabase as any).rpc("log_phi_access", {
      _resource_type: opts.resourceType,
      _resource_id: opts.resourceId ?? null,
      _client_email: opts.clientEmail ?? null,
      _action: opts.action ?? "view",
      _route: route,
      _metadata: opts.metadata ?? null,
    });
  } catch {
    // never throw from audit
  }
}
