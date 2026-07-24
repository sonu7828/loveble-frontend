// Shared types and helpers for the StaffCheckout components.
// Keep this file tiny — anything bigger belongs in a hook or a component.

export type LineItem = {
  kind: "service" | "unit_service" | "product" | "package" | "service_addon" | "custom";
  reference_id?: string | null;
  label: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  metadata?: Record<string, any>;
  tippable?: boolean;
  taxable?: boolean;
};

export const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export const functionErrorMessage = async (error: any, fallback = "Checkout failed") => {
  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = await response.clone().json();
      if (body?.error) return body.error;
    } catch {
      try {
        const text = await response.clone().text();
        if (text) return text;
      } catch {
        // Fall through to the generic fallback below.
      }
    }
  }
  return error?.message && !String(error.message).includes("non-2xx") ? error.message : fallback;
};
