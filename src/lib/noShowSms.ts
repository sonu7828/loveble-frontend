// Immediate SMS sent when an appointment is marked no-show.
// Client is checked on ("hope you're okay") and invited to reschedule.
// Called from every no-show entry point (StaffToday, StaffAppointmentDetail,
// and ChargeNoShowDialog outcomes). Never blocks the UI on failure.
import { supabase } from "@/integrations/supabase/client";

export async function sendNoShowSms(
  appointmentId: string,
  firstName?: string | null,
) {
  const name = (firstName || "there").trim();
  const message =
    `Hi ${name}, this is Kiem at Radiantilyk Aesthetic — we missed you at your ` +
    `appointment today and just wanted to check in and make sure you're okay. ` +
    `If you'd like to reschedule, reply here and we'll get you back on the ` +
    `calendar. Reply STOP to opt out.`;
  try {
    await supabase.functions.invoke("send-appointment-sms", {
      body: { appointmentId, message, overrideOptIn: true },
    });
  } catch (e) {
    console.warn("no-show sms failed", e);
  }
}
