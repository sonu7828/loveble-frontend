import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Star, Loader2, AlertCircle, MessageSquareQuote, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Row = {
  id: string;
  appointment_id: string;
  client_email: string;
  rating: number;
  comment: string | null;
  allow_testimonial: boolean;
  featured: boolean;
  google_review_sms_sent_at: string | null;
  created_at: string;
  staff_id: string | null;
  service_id: string | null;
  location_id: string | null;
  staff?: { full_name: string } | null;
  service?: { name: string } | null;
  location?: { name: string } | null;
  appointment?: { client_first_name: string | null; client_last_name: string | null } | null;
};

export default function StaffFeedback() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "high" | "testimonials">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_feedback")
      .select(`id, appointment_id, client_email, rating, comment, allow_testimonial, featured, google_review_sms_sent_at, created_at, staff_id, service_id, location_id,
        staff:staff_profiles(full_name), service:services(name), location:locations(name),
        appointment:appointments(client_first_name, client_last_name)`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    switch (filter) {
      case "low": return rows.filter(r => r.rating <= 3);
      case "high": return rows.filter(r => r.rating >= 4);
      case "testimonials": return rows.filter(r => r.allow_testimonial && r.rating >= 4);
      default: return rows;
    }
  }, [rows, filter]);

  const stats = useMemo(() => {
    const n = rows.length;
    const avg = n ? rows.reduce((s, r) => s + r.rating, 0) / n : 0;
    const low = rows.filter(r => r.rating <= 3).length;
    return { n, avg, low };
  }, [rows]);

  const toggleFeatured = async (r: Row) => {
    const next = !r.featured;
    setRows(rs => rs.map(x => x.id === r.id ? { ...x, featured: next } : x));
    const { error } = await supabase.from("client_feedback").update({ featured: next }).eq("id", r.id);
    if (error) {
      toast.error(error.message);
      setRows(rs => rs.map(x => x.id === r.id ? { ...x, featured: !next } : x));
    } else {
      toast.success(next ? "Featured as testimonial" : "Unfeatured");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">Client feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            5★ ratings auto-route to Google. Lower ratings land here so you can follow up privately.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Total responses" value={String(stats.n)} />
        <Stat label="Avg rating" value={stats.avg ? stats.avg.toFixed(2) : "—"} />
        <Stat label="Low (≤3★)" value={String(stats.low)} tone={stats.low > 0 ? "warn" : undefined} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "low", "high", "testimonials"] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
            className="rounded-full capitalize" onClick={() => setFilter(f)}>
            {f === "low" ? "Low (≤3★)" : f === "high" ? "High (4–5★)" : f}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 border border-dashed rounded-2xl">
          No feedback yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const name = [r.appointment?.client_first_name, r.appointment?.client_last_name].filter(Boolean).join(" ") || r.client_email;
            const low = r.rating <= 3;
            return (
              <div key={r.id} className={`rounded-2xl border p-4 ${low ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      {low && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Needs follow-up</Badge>}
                      {r.featured && <Badge className="gap-1"><MessageSquareQuote className="h-3 w-3" /> Featured</Badge>}
                      {r.google_review_sms_sent_at && <Badge variant="secondary" className="gap-1"><Send className="h-3 w-3" /> Google link sent</Badge>}
                    </div>
                    <div className="mt-1.5 text-sm font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "MMM d, yyyy h:mm a")}
                      {r.staff?.full_name && <> · {r.staff.full_name}</>}
                      {r.service?.name && <> · {r.service.name}</>}
                      {r.location?.name && <> · {r.location.name}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Feature</span>
                      <Switch checked={r.featured} onCheckedChange={() => toggleFeatured(r)} />
                    </label>
                    <Link to={`/staff/appointments/${r.appointment_id}`}>
                      <Button size="sm" variant="outline" className="rounded-full">Open visit</Button>
                    </Link>
                  </div>

                </div>
                {r.comment && (
                  <p className="mt-3 text-sm whitespace-pre-wrap">{r.comment}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "warn" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-2xl">{value}</div>
    </div>
  );
}
