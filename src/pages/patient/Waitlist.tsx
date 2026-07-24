import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Bell, Check, ArrowLeft } from "lucide-react";
import { formatPhone10 } from "@/lib/formatPhone";

interface Service { id: string; name: string; }
interface Location { id: string; name: string; city: string; }

export default function Waitlist() {
  const [params] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    serviceId: params.get("service") ?? "",
    locationId: params.get("location") ?? "any",
    dateFrom: "", dateTo: "", notes: "",
  });

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: l }, sess] = await Promise.all([
        supabase.from("services").select("id, name").eq("is_active", true).order("display_order"),
        supabase.from("locations").select("id, name, city").eq("is_active", true),
        supabase.auth.getSession(),
      ]);
      setServices(s ?? []);
      setLocations(l ?? []);

      const userId = sess.data.session?.user?.id;
      const userEmail = sess.data.session?.user?.email;
      if (userId) {
        const { data: prof } = await supabase
          .from("client_profiles").select("first_name, last_name, email, phone").eq("user_id", userId).maybeSingle();
        if (prof) {
          setForm((prev) => ({
            ...prev,
            firstName: prof.first_name ?? prev.firstName,
            lastName: prof.last_name ?? prev.lastName,
            email: prof.email ?? userEmail ?? prev.email,
            phone: prof.phone ?? prev.phone,
          }));
        } else if (userEmail) {
          setForm((prev) => ({ ...prev, email: userEmail }));
        }
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.serviceId || !form.dateFrom || !form.dateTo) {
      toast.error("Please fill out all required fields"); return;
    }
    if (form.dateTo < form.dateFrom) { toast.error("End date must be after start date"); return; }
    setSaving(true);
    const id = crypto.randomUUID();
    const locationId = form.locationId === "any" ? null : form.locationId;
    const { error } = await supabase.from("waitlist_requests").insert({
      id,
      client_first_name: form.firstName.trim(),
      client_last_name: form.lastName.trim(),
      client_email: form.email.trim().toLowerCase(),
      client_phone: form.phone.trim(),
      service_id: form.serviceId,
      location_id: locationId,
      desired_date_from: form.dateFrom,
      desired_date_to: form.dateTo,
      notes: form.notes.trim() || null,
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Notify staff/admins (best effort)
    try {
      const svcName = services.find(s => s.id === form.serviceId)?.name;
      const locName = locationId ? locations.find(l => l.id === locationId)?.name : "Either location";
      await supabase.functions.invoke("notify-waitlist-join", {
        body: {
          waitlistId: id,
          clientName: `${form.firstName} ${form.lastName}`.trim(),
          clientEmail: form.email.trim().toLowerCase(),
          clientPhone: form.phone.trim(),
          serviceName: svcName,
          locationName: locName,
          windowLabel: `${form.dateFrom} → ${form.dateTo}`,
          notes: form.notes.trim() || undefined,
        },
      });
    } catch (e) { console.error("waitlist notify failed", e); }

    setSaving(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
        {submitted ? (
          <div className="text-center py-16">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Check className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-display mb-3">You're on the list</h1>
            <p className="text-muted-foreground mb-6">
              We'll text and email you the moment a matching slot opens. First to rebook gets it.
            </p>
            <Button asChild className="rounded-full"><Link to="/book">Browse other times</Link></Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <Bell className="h-7 w-7 mx-auto text-primary mb-3" />
              <h1 className="text-3xl sm:text-4xl font-display">Join the waitlist</h1>
              <p className="text-muted-foreground mt-2">
                Don't see a time that works? Add yourself to our waitlist and we'll text you the second a matching slot opens.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-5 bg-card border rounded-2xl p-6 sm:p-8">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>First name *</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><Label>Last name *</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Mobile phone (10 digits) *</Label><Input type="tel" placeholder="(555) 000-0000" maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone10(e.target.value) })} /></div>
              </div>
              <div>
                <Label>Service *</Label>
                <Select value={form.serviceId} onValueChange={(v) => setForm({ ...form, serviceId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred location</Label>
                <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Either location</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} — {l.city}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>When would you like to come in? *</Label>
                <div className="flex flex-wrap gap-2 mt-2 mb-3">
                  {[
                    { label: "Next 2 weeks", days: 14 },
                    { label: "Next month", days: 30 },
                    { label: "Anytime in 3 months", days: 90 },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        const from = new Date(); from.setDate(from.getDate() + 1);
                        const to = new Date(); to.setDate(to.getDate() + opt.days);
                        const fmt = (d: Date) => d.toISOString().slice(0, 10);
                        setForm(f => ({ ...f, dateFrom: fmt(from), dateTo: fmt(to) }));
                      }}
                      className="rounded-full border border-border hover:border-primary/60 px-3 py-1.5 text-xs transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs text-muted-foreground">Earliest</Label><Input type="date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} /></div>
                  <div><Label className="text-xs text-muted-foreground">Latest</Label><Input type="date" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} /></div>
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferred times of day, etc." />
              </div>
              <Button type="submit" disabled={saving} className="w-full rounded-full" size="lg">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Join waitlist"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By joining, you agree to receive a one-time SMS/email when a slot opens. Standard rates apply.
              </p>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
