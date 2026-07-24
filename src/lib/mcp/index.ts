import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listAppointments from "./tools/list-appointments";
import searchClients from "./tools/search-clients";
import listTodaysSchedule from "./tools/list-todays-schedule";
import getClientSummary from "./tools/get-client-summary";
import listRecentSales from "./tools/list-recent-sales";
import listServices from "./tools/list-services";
import listStaff from "./tools/list-staff";
import listClinicalNotes from "./tools/list-clinical-notes";

// Construct the OAuth issuer from the Supabase project ref so it matches the
// direct supabase.co discovery document (never the .lovable.cloud proxy).
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time so this stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "radiantilyk-mcp",
  title: "Radiantilyk Aesthetic",
  version: "0.2.0",
  instructions:
    "Tools for the Radiantilyk Aesthetic staff app. All tools act as the signed-in staff user and respect Row-Level Security. Read-only. PHI-sensitive tools (search_clients, get_client_summary, list_clinical_notes) return protected health information — use only when the task requires it.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    listTodaysSchedule,
    listAppointments,
    searchClients,
    getClientSummary,
    listClinicalNotes,
    listRecentSales,
    listServices,
    listStaff,
  ],
});
