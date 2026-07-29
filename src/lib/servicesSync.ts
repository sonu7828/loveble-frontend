// Radiantilyk Aesthetic — Real-Time Service Pricing & Catalog Sync Utility

export interface ServiceOverride {
  price_cents?: number | null;
  price_note?: string | null;
  rebook_followup_days?: number | null;
  is_featured?: boolean;
}

export function getServiceOverrides(): Record<string, ServiceOverride> {
  try {
    return JSON.parse(localStorage.getItem("rka_services_overrides") || "{}");
  } catch {
    return {};
  }
}

export function saveServiceOverride(serviceId: string, override: Partial<ServiceOverride>) {
  const current = getServiceOverrides();
  current[serviceId] = {
    ...current[serviceId],
    ...override,
  };
  localStorage.setItem("rka_services_overrides", JSON.stringify(current));
  window.dispatchEvent(new Event("rka_services_updated"));
}

export function applyServiceOverrides<T extends { id: string; price_cents?: number | null; price_note?: string | null }>(services: T[]): T[] {
  const overrides = getServiceOverrides();
  if (Object.keys(overrides).length === 0) return services;

  return services.map((s) => {
    const ov = overrides[s.id];
    if (ov) {
      return {
        ...s,
        price_cents: ov.price_cents !== undefined ? ov.price_cents : s.price_cents,
        price_note: ov.price_note !== undefined ? ov.price_note : s.price_note,
      };
    }
    return s;
  });
}

export function applySingleServiceOverride<T extends { id: string; price_cents?: number | null; price_note?: string | null }>(service: T | null): T | null {
  if (!service) return null;
  const overrides = getServiceOverrides();
  const ov = overrides[service.id];
  if (ov) {
    return {
      ...service,
      price_cents: ov.price_cents !== undefined ? ov.price_cents : service.price_cents,
      price_note: ov.price_note !== undefined ? ov.price_note : service.price_note,
    };
  }
  return service;
}
