import { supabase } from "@/integrations/supabase/client";

export interface UnifiedStaffMember {
  id: string;
  full_name: string;
  title: string;
  email: string | null;
  role?: string;
  is_active: boolean;
}

export async function fetchUnifiedStaffMembers(): Promise<UnifiedStaffMember[]> {
  let remote: UnifiedStaffMember[] = [];
  try {
    const { data } = await supabase
      .from("staff_profiles")
      .select("id, full_name, title, email, is_active")
      .eq("is_active", true)
      .order("full_name");
    if (data) remote = data as UnifiedStaffMember[];
  } catch (e) {}

  const demoMembers: any[] = JSON.parse(localStorage.getItem("rka_demo_team_members") || "[]");
  const approvedAccounts: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
  const pendingRequests: any[] = JSON.parse(localStorage.getItem("rka_pending_member_requests") || "[]");

  const combined: UnifiedStaffMember[] = [...remote];
  const existingNames = new Set(combined.map((x) => x.full_name.toLowerCase()));

  demoMembers.forEach((m: any) => {
    if (m.full_name && !existingNames.has(m.full_name.toLowerCase())) {
      combined.push({
        id: m.id || `demo-staff-${m.full_name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
        full_name: m.full_name,
        title: m.title || "Staff Provider",
        email: m.email || null,
        is_active: true,
      });
      existingNames.add(m.full_name.toLowerCase());
    }
  });

  approvedAccounts.forEach((a: any) => {
    if (a.full_name && !existingNames.has(a.full_name.toLowerCase())) {
      combined.push({
        id: `approved-staff-${a.email ? a.email.replace(/[^a-z0-9]/gi, "-") : Date.now()}`,
        full_name: a.full_name,
        title: a.role ? a.role.replace("_", " ").toUpperCase() : "Staff Provider",
        email: a.email || null,
        is_active: true,
      });
      existingNames.add(a.full_name.toLowerCase());
    }
  });

  pendingRequests.forEach((p: any) => {
    if (p.full_name && !existingNames.has(p.full_name.toLowerCase())) {
      combined.push({
        id: p.id || `pending-staff-${Date.now()}`,
        full_name: p.full_name,
        title: p.title || "Staff Provider",
        email: p.email || null,
        is_active: true,
      });
      existingNames.add(p.full_name.toLowerCase());
    }
  });

  const defaultProviders = [
    { id: "staff-dhruva", full_name: "Dhruva", title: "Medical Director", email: "dhruva@gmail.com", role: "medical_director", is_active: true },
    { id: "staff-shaley", full_name: "Shaley", title: "General Physician", email: "shaley@gmail.com", role: "provider", is_active: true },
    { id: "staff-oggy", full_name: "Oggy", title: "General Practitioner", email: "oggy@gmail.com", role: "provider", is_active: true },
    { id: "staff-cherry", full_name: "Cherry", title: "Provider", email: "cherry@gmail.com", role: "provider", is_active: true },
  ];

  defaultProviders.forEach((d) => {
    if (!existingNames.has(d.full_name.toLowerCase())) {
      combined.push(d);
      existingNames.add(d.full_name.toLowerCase());
    }
  });

  return combined;
}
