import { ApiClient } from "@/services/api";

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
 * Records a PHI access event via Express API. Fire-and-forget — never blocks the UI.
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
    ApiClient.post("/admin/phi-audit", {
      resource_type: opts.resourceType,
      resource_id: opts.resourceId ?? null,
      client_email: opts.clientEmail ?? null,
      action: opts.action ?? "view",
      route: route,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // never throw from audit
  }
}
