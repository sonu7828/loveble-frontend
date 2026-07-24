import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase = supabaseTyped as any;
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

export default function ProtocolHistory() {
  const { protocolId = "" } = useParams();
  const { isNP, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    if (!protocolId || authLoading) return;
    (async () => {
      const [{ data: p }, { data: vs }] = await Promise.all([
        (supabase as any).from("clinical_protocols").select("title").eq("id", protocolId).maybeSingle(),
        (supabase as any).from("clinical_protocol_versions").select("id, version_number, status, signed_at, signed_by_name, created_at").eq("protocol_id", protocolId).order("version_number", { ascending: false }),
      ]);
      setTitle((p as any)?.title ?? "");
      setVersions(vs ?? []);
      setLoading(false);
    })();
  }, [protocolId, authLoading]);

  if (authLoading || loading) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isNP && !isAdmin) return <Navigate to="/staff/clinical" replace />;

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <Link to="/staff/clinical/protocols" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" /> Back to protocols
      </Link>
      <h1 className="font-serif text-3xl mb-1">{title}</h1>
      <p className="text-sm text-muted-foreground mb-6">Version history</p>
      <div className="border border-border rounded-xl bg-card divide-y divide-border">
        {versions.map(v => (
          <Link key={v.id} to={`/staff/clinical/protocols/${v.id}`} className="flex items-center justify-between p-4 hover:bg-secondary/40 transition">
            <div>
              <div className="font-medium">Version {v.version_number}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {v.status === "published" ? (
                  <span className="inline-flex items-center gap-1 text-success-soft-foreground">
                    <ShieldCheck className="h-3 w-3" /> Signed {v.signed_at ? format(new Date(v.signed_at), "MMM d, yyyy") : "—"} by {v.signed_by_name ?? "—"}
                  </span>
                ) : (
                  <span className="text-warning-soft-foreground">Draft · created {format(new Date(v.created_at), "MMM d, yyyy")}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
        {versions.length === 0 && <div className="p-6 text-sm text-muted-foreground">No versions yet.</div>}
      </div>
    </div>
  );
}
