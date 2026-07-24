export type Step = 1 | 2 | 3 | 4 | 5;

export interface Category { id: string; name: string; description: string | null; display_order: number; }
export interface Service { id: string; category_id: string; name: string; duration_minutes: number; description?: string | null; price_cents?: number | null; price_note?: string | null; }
export interface Location { id: string; name: string; city: string; address: string; }
export interface Staff { id: string; full_name: string; title: string; color: string; }
export interface ProviderRow { service_id: string; staff_id: string; location_id: string; }
export interface ConsentForm {
  id: string; slug: string; title: string; body_markdown: string;
  version: number; is_universal: boolean; is_optional?: boolean; alreadySigned: boolean;
}
