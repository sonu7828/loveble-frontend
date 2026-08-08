import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiQuery, authService, ApiClient } from "@/services/api";
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

export default function Waitlist() {
  const [params] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    serviceId: params.get("service") ?? "",
    dateFrom: "", dateTo: "", notes: "",
  });

  useEffect(() => {
    (async () => {
      const [{ data: s }, sess] = await Promise.all([
        apiQuery("services").select("id, name").eq("is_active", true).order("display_order"),
        authService.getSession(),
      ]);
      setServices(s ?? []);

      const userId = sess.data.session?.user?.id;
      const userEmail = sess.data.session?.user?.email;
      if (userId) {
        const { data: prof } = await apiQuery
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
    const { data, error } = await ApiClient.post("/appointments/waitlist", {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      serviceId: form.serviceId,
      preferredDays: `${form.dateFrom} to ${form.dateTo}`,
      notes: form.notes.trim() || null,
    });
    if (error) { setSaving(false); toast.error(error); return; }

    const waitlistId = (data as any)?.id || crypto.randomUUID();

    // Notify staff/admins (best effort)
    try {
      const svcName = services.find(s => s.id === form.serviceId)?.name;
      await ApiClient.post("notify-waitlist-join", {
        body: {
          waitlistId,
          clientName: `${form.firstName} ${form.lastName}`.trim(),
          clientEmail: form.email.trim().toLowerCase(),
          clientPhone: form.phone.trim(),
          serviceName: svcName,
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
      <main className="flex-1 max-w-lg mx-auto px-4 sm:px-6 py-6 w-full">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>
        {submitted ? (
          <div className="text-center py-12">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 mb-3">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-display mb-2">You're on the list</h1>
            <p className="text-sm text-muted-foreground mb-5">
              We'll text and email you the moment a matching slot opens. First to rebook gets it.
            </p>
            <Button asChild className="rounded-full" size="sm"><Link to="/book">Browse other times</Link></Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <Bell className="h-5 w-5 mx-auto text-primary mb-2" />
              <h1 className="text-2xl sm:text-3xl font-display">Join the waitlist</h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                Don't see a time that works? Add yourself to our waitlist and we'll text you the second a matching slot opens.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-3.5 bg-card border rounded-xl p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">First name *</Label><Input className="h-8 text-sm mt-0.5" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><Label className="text-xs">Last name *</Label><Input className="h-8 text-sm mt-0.5" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Email *</Label><Input className="h-8 text-sm mt-0.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label className="text-xs">Mobile phone *</Label><Input className="h-8 text-sm mt-0.5" type="tel" placeholder="(555) 000-0000" maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone10(e.target.value) })} /></div>
              </div>
              <div>
                <Label className="text-xs">Service *</Label>
                <Select value={form.serviceId} onValueChange={(v) => setForm({ ...form, serviceId: v })}>
                  <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">When would you like to come in? *</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
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
                      className="rounded-full border border-border hover:border-primary/60 px-2.5 py-1 text-[11px] transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-[11px] text-muted-foreground">Earliest</Label><Input className="h-8 text-sm mt-0.5" type="date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} /></div>
                  <div><Label className="text-[11px] text-muted-foreground">Latest</Label><Input className="h-8 text-sm mt-0.5" type="date" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} /></div>
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea className="text-sm mt-0.5 min-h-[64px] resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferred times of day, etc." />
              </div>
              <Button type="submit" disabled={saving} className="w-full rounded-full h-9 text-sm" size="sm">
                {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Saving...</> : "Join waitlist"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
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
