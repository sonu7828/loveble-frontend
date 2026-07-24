import whoami from "./tools/whoami";
import listAppointments from "./tools/list-appointments";
import searchClients from "./tools/search-clients";
import listTodaysSchedule from "./tools/list-todays-schedule";
import getClientSummary from "./tools/get-client-summary";
import listRecentSales from "./tools/list-recent-sales";
import listServices from "./tools/list-services";
import listStaff from "./tools/list-staff";
import listClinicalNotes from "./tools/list-clinical-notes";

export default {
  name: "radiantilyk-mcp",
  title: "Radiantilyk Aesthetic API",
  version: "0.2.0",
  instructions:
    "Tools for the Radiantilyk Aesthetic staff app connecting to custom Node.js API backend.",
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
};
