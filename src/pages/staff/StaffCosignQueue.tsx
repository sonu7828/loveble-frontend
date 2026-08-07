import { useEffect, useState } from "react";
import { apiQuery, authService, ApiClient, clinicalService } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ClipboardCheck, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isTestPatient } from "@/lib/testPatientFilter";

type Note = {
  id: string;
  appointment_id: string | null;
  client_email: string;
  client_first_name: string | null;
  client_last_name: string | null;
  service_name: string | null;
  category: string;
  provider_name: string | null;
  provider_role: string | null;
  signed_at: string | null;
  status: string;
};

export default function StaffCosignQueue() {
  const { isNP, isMedicalDirector, loading } = useAuth();
  const isSupervising = isNP || isMedicalDirector;
  const [notes, setNotes] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const fetchQueue = async () => {
    try {
      const queue = await clinicalService.getCosignQueue();
      let dbNotes: any[] = [];
      try {
        const { data } = await apiQuery("clinical_notes").select("*").order("created_at", { ascending: false }).limit(50);
        if (data) dbNotes = data;
      } catch { }

      let localNotes: any[] = [];
      try {
        localNotes = JSON.parse(localStorage.getItem("rka_demo_clinical_notes") || "[]");
      } catch { }

      const map = new Map<string, any>();

      // Queue items
      queue.forEach((item: any) => {
        const noteId = item.note?.id || item.noteId;
        if (noteId) {
          map.set(noteId, {
            id: noteId,
            appointment_id: item.note?.appointmentId || null,
            client_email: item.note?.patient?.email || "—",
            client_first_name: item.note?.patient?.firstName || "",
            client_last_name: item.note?.patient?.lastName || "",
            service_name: item.note?.serviceName || "Clinical Note",
            category: item.note?.category || "soap",
            provider_name: item.author?.fullName || "RN Injector",
            provider_role: item.author?.title || "RN",
            signed_at: item.note?.signedAt || item.requestedAt,
            status: item.note?.status || "pending_cosign",
          });
        }
      });

      // DB notes
      dbNotes.forEach((n: any) => {
        if (n.id) {
          map.set(n.id, {
            id: n.id,
            appointment_id: n.appointment_id || null,
            client_email: n.client_email || "—",
            client_first_name: n.client_first_name || "",
            client_last_name: n.client_last_name || "",
            service_name: n.service_name || n.category || "Clinical Note",
            category: n.category || "soap",
            provider_name: n.provider_name || "Clinician",
            provider_role: n.provider_role || "Provider",
            signed_at: n.signed_at || n.created_at,
            status: n.status || "signed",
          });
        }
      });

      // Local notes
      localNotes.forEach((n: any) => {
        if (n.id) {
          map.set(n.id, {
            id: n.id,
            appointment_id: n.appointment_id || null,
            client_email: n.client_email || "—",
            client_first_name: n.client_first_name || "",
            client_last_name: n.client_last_name || "",
            service_name: n.service_name || n.category || "Clinical Note",
            category: n.category || "soap",
            provider_name: n.provider_name || "Clinician",
            provider_role: n.provider_role || "Provider",
            signed_at: n.signed_at || n.created_at,
            status: n.status || "signed",
          });
        }
      });

      const sorted = Array.from(map.values())
        .filter((n) => !isTestPatient(n))
        .sort((a, b) => {
          const tA = new Date(a.signed_at || 0).getTime();
          const tB = new Date(b.signed_at || 0).getTime();
          return tB - tA;
        });

      setNotes(sorted);
    } catch (e) {
      setNotes([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    fetchQueue();
    const handleUpdate = () => fetchQueue();
    window.addEventListener("rka_chart_note_updated", handleUpdate);
    window.addEventListener("rka_cosign_updated", handleUpdate);
    return () => {
      window.removeEventListener("rka_chart_note_updated", handleUpdate);
      window.removeEventListener("rka_cosign_updated", handleUpdate);
    };
  }, [loading]);

  if (loading) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <header className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-serif flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              Co-sign Queue
            </h1>
            <Badge variant="outline" className="text-[10px]">
              {isSupervising ? "Supervising Provider View" : "RN Injector View"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isSupervising
              ? "Review and e-sign clinical chart notes submitted by RN injectors."
              : "Track your submitted chart notes awaiting NP / Medical Director co-signature."}
          </p>
        </div>
      </header>

      {busy ? (
        <div className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">All caught up. No notes awaiting co-signature.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(n => {
            const waitingDays = n.signed_at
              ? Math.floor((Date.now() - new Date(n.signed_at).getTime()) / 86400000)
              : 0;
            const stale = waitingDays >= 3;
            const name = `${n.client_first_name ?? ""} ${n.client_last_name ?? ""}`.trim() || n.client_email;
            return (
              <Link
                key={n.id}
                to={`/staff/clinical/notes/${n.id}`}
                className={`block rounded-lg border bg-card p-4 hover:shadow-sm transition ${stale ? "border-destructive/40" : "border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">{n.service_name ?? n.category}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <span>RN: {n.provider_name ?? "—"}</span>
                      <span>·</span>
                      <span>Signed {n.signed_at ? format(new Date(n.signed_at), "MMM d, h:mm a") : "—"}</span>
                      {waitingDays > 0 && (
                        <>
                          <span>·</span>
                          <span className={stale ? "text-destructive font-medium" : ""}>
                            {waitingDays}d waiting
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1.5 pointer-events-none shrink-0">
                    Review <ChevronRight className="h-4 w-4 ml-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
