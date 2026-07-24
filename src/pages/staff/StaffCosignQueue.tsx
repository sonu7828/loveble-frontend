import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ClipboardCheck, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

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
  const { isAdmin, isNP, isMedicalDirector, loading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin && !isNP && !isMedicalDirector) { setBusy(false); return; }
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("clinical_notes")
        .select("id, appointment_id, client_email, client_first_name, client_last_name, service_name, category, provider_name, provider_role, signed_at, status")
        .eq("requires_cosign", true)
        .eq("status", "signed")
        .order("signed_at", { ascending: true })
        .limit(200);
      if (cancel) return;
      if (!error) setNotes((data ?? []) as Note[]);
      setBusy(false);
    })();
    return () => { cancel = true; };
  }, [loading, isAdmin, isNP, isMedicalDirector]);

  if (loading) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isAdmin && !isNP && !isMedicalDirector) return <Navigate to="/staff/today" replace />;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl font-serif flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Co-sign queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chart notes signed by RNs that require an NP / supervising provider co-signature.
        </p>
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
                  <Button size="sm" variant="outline">
                    Review <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
