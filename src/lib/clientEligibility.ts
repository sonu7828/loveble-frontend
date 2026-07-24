// Client eligibility engine — inspects a client and returns the discount perks
// they qualify for right now. Consumed by the checkout EligibilityStrip so the
// receptionist can one-tap-apply the right discount instead of remembering rules.
import { supabase } from "@/integrations/supabase/client";

export type EligibilityPerk = {
  key: string;
  label: string;         // chip text, e.g. "New client · 10%"
  reason: string;        // stored in sales.discount_reason
  kind: "percent" | "amount";
  value: number;         // percent (1–100) or dollars off
  note?: string;         // small caption under the chip
};

type Presets = {
  friend: number;
  review_dollars: number;
  healthcare: number;
  new_client: number;
  birthday: number;
  referral_dollars: number;
};

const DEFAULT_PRESETS: Presets = {
  friend: 10,
  review_dollars: 25,
  healthcare: 15,
  new_client: 10,
  birthday: 10,
  referral_dollars: 25,
};

export async function loadDiscountPresets(): Promise<Presets> {
  const { data } = await supabase
    .from("app_settings" as any)
    .select("discount_presets")
    .limit(1)
    .maybeSingle();
  const p = (data as any)?.discount_presets ?? {};
  return { ...DEFAULT_PRESETS, ...p };
}

export async function getClientEligibility(
  clientEmail: string | null | undefined,
): Promise<EligibilityPerk[]> {
  if (!clientEmail) return [];
  const email = clientEmail.toLowerCase();
  const presets = await loadDiscountPresets();

  const [perksRes, profileRes, paidCountRes, reviewRes, referralRes] = await Promise.all([
    supabase
      .from("client_perks" as any)
      .select("is_healthcare_worker, is_friend")
      .eq("client_email", email)
      .maybeSingle(),
    supabase
      .from("client_profiles")
      .select("dob")
      .ilike("email", email)
      .maybeSingle(),
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .ilike("client_email", email)
      .eq("status", "paid"),
    supabase
      .from("client_review_promos" as any)
      .select("id")
      .ilike("client_email", email)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("referral_codes")
      .select("code")
      .ilike("owner_email", email)
      .maybeSingle(),
  ]);

  const perks: EligibilityPerk[] = [];
  const tagged: any = perksRes.data ?? {};
  const profile: any = profileRes.data ?? {};
  const paidCount = paidCountRes.count ?? 0;

  if (tagged.is_friend) {
    perks.push({
      key: "friend",
      label: `Friend · ${presets.friend}%`,
      reason: "Friend",
      kind: "percent",
      value: presets.friend,
      note: "Tagged as friend",
    });
  }

  if (tagged.is_healthcare_worker) {
    perks.push({
      key: "healthcare",
      label: `Healthcare worker · ${presets.healthcare}%`,
      reason: "Healthcare worker",
      kind: "percent",
      value: presets.healthcare,
      note: "Tagged on profile",
    });
  }

  if (paidCount === 0) {
    perks.push({
      key: "new_client",
      label: `New client · ${presets.new_client}%`,
      reason: "New client",
      kind: "percent",
      value: presets.new_client,
      note: "First paid visit",
    });
  }

  if (profile.dob) {
    const dob = new Date(profile.dob);
    if (!Number.isNaN(dob.getTime()) && dob.getUTCMonth() === new Date().getUTCMonth()) {
      perks.push({
        key: "birthday",
        label: `Birthday month · ${presets.birthday}%`,
        reason: "Birthday",
        kind: "percent",
        value: presets.birthday,
        note: "This month only",
      });
    }
  }


  if (reviewRes.data) {
    perks.push({
      key: "review",
      label: `Google review · $${presets.review_dollars}`,
      reason: "Review",
      kind: "amount",
      value: presets.review_dollars,
      note: "Left an unused review promo",
    });
  }

  if (referralRes.data) {
    // Presence of a referral code means they've referred at some point; we still
    // let the receptionist decide whether to apply it.
    perks.push({
      key: "referral",
      label: `Referral · $${presets.referral_dollars}`,
      reason: "Referral",
      kind: "amount",
      value: presets.referral_dollars,
      note: "Has a referral code",
    });
  }

  return perks;
}
