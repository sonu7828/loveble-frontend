import { ApiClient } from "@/services/api";

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
    await ApiClient.post("/messaging/send-sms", { appointmentId, message, overrideOptIn: true });
  } catch (e) {
    console.warn("no-show sms failed", e);
  }
}
