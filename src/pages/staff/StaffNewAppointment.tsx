import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Loader2, CalendarIcon, X, Plus } from "lucide-react";
import { format } from "date-fns";
import { CardOnFile, type CardOnFileHandle } from "@/components/CardOnFile";
import { StaffClientSearch } from "@/components/staff/StaffClientSearch";
import { toast } from "sonner";
import { formatPhone10 } from "@/lib/formatPhone";


import { fetchUnifiedStaffMembers } from "@/lib/unifiedStaff";

export default function StaffNewAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canSeeAll, staffId, canOverride } = useAuth();
  const cardRef = useRef<CardOnFileHandle>(null);

  const [services, setServices] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffIdSel, setStaffIdSel] = useState("");
  const [locationId, setLocationId] = useState("");
  const [pickedDate, setPickedDate] = useState<Date | undefined>(() => {
    const d = searchParams.get("date");
    if (!d) return undefined;
    const [y, m, day] = d.split("-").map(Number);
    if (!y || !m || !day) return undefined;
    return new Date(y, m - 1, day);
  });
  const [pickedSlot, setPickedSlot] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [client, setClient] = useState({
    firstName: searchParams.get("firstName") ?? "",
    lastName: searchParams.get("lastName") ?? "",
    email: searchParams.get("email") ?? "",
    phone: searchParams.get("phone") ?? "",
    dob: searchParams.get("dob") ?? "",
    notes: "",
  });
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [collectCard, setCollectCard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [existingCard, setExistingCard] = useState<{ customerId: string; paymentMethodId: string } | null>(null);
  const [useExistingCard, setUseExistingCard] = useState(true);

  // Look up an existing card on file for this email (most recent appt with stored card)
  useEffect(() => {
    const email = client.email.trim().toLowerCase();
    if (!email) { setExistingCard(null); return; }
    let cancelled = false;
    supabase
      .from("appointments")
      .select("stripe_customer_id, stripe_payment_method_id, created_at")
      .ilike("client_email", email)
      .not("stripe_customer_id", "is", null)
      .not("stripe_payment_method_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.stripe_customer_id && data?.stripe_payment_method_id) {
          setExistingCard({ customerId: data.stripe_customer_id, paymentMethodId: data.stripe_payment_method_id });
          setUseExistingCard(true);
        } else {
          setExistingCard(null);
        }
      });
    return () => { cancelled = true; };
  }, [client.email]);

  useEffect(() => {
    Promise.all([
      supabase.from("services").select("id, name, duration_minutes").eq("is_active", true).order("name"),
      supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
      fetchUnifiedStaffMembers(),
      supabase.from("service_providers").select("service_id, staff_id, location_id"),
    ]).then(([s, l, st, p]) => {
      setServices(s.data ?? []);
      setLocations(l.data ?? []);
      setStaff(st);
      setProviders(p.data ?? []);
      if (!canSeeAll && staffId) setStaffIdSel(staffId);
    });
  }, [canSeeAll, staffId]);

  // Generate fallback demo clinic slots: 9 AM – 6 PM every 30 min on the chosen date
  const generateFallbackSlots = (date: Date): string[] => {
    const slots: string[] = [];
    const start = 9 * 60;   // 9:00 AM
    const end   = 18 * 60;  // 6:00 PM
    for (let m = start; m < end; m += 30) {
      const d = new Date(date);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      slots.push(d.toISOString());
    }
    return slots;
  };

  // Load slots when services+staff+location+date are set
  useEffect(() => {
    setPickedSlot("");
    if (serviceIds.length === 0 || !staffIdSel || !locationId || !pickedDate) { setSlots([]); return; }
    setLoadingSlots(true);
    const dateStr = format(pickedDate, "yyyy-MM-dd");
    supabase.functions.invoke("get-availability", {
      body: { serviceIds, staffId: staffIdSel, locationId, date: dateStr, includeConflicts: canOverride && overrideConflict },
    }).then(({ data }) => {
      const returned: string[] = data?.slots ?? [];
      // If no slots came back (demo/local staff with no DB schedule), generate fallback clinic hours
      setSlots(returned.length > 0 ? returned : generateFallbackSlots(pickedDate));
      setLoadingSlots(false);
    }).catch(() => {
      // Edge function unreachable — still show fallback slots
      setSlots(generateFallbackSlots(pickedDate));
      setLoadingSlots(false);
    });
  }, [serviceIds, staffIdSel, locationId, pickedDate, overrideConflict, canOverride]);

  // Valid combos: all staff members created are selectable
  const validStaffIds = useMemo(() => {
    return new Set(staff.map(s => s.id));
  }, [staff]);

  const validLocIds = useMemo(() => {
    return new Set(locations.map(l => l.id));
  }, [locations]);

  // Auto-default provider if only one valid choice
  useEffect(() => {
    if (!staffIdSel && validStaffIds.size === 1) {
      const only = staff.find(s => validStaffIds.has(s.id));
      if (only) setStaffIdSel(only.id);
    }
  }, [validStaffIds, staffIdSel, staff]);

  // Auto-default location if only one valid choice
  useEffect(() => {
    if (!locationId && validLocIds.size === 1) {
      const only = locations.find(l => validLocIds.has(l.id));
      if (only) setLocationId(only.id);
    }
  }, [validLocIds, locationId, locations]);

  const totalMinutes = serviceIds.reduce((sum, id) => {
    const s = services.find(x => x.id === id);
    return sum + (s?.duration_minutes ?? 0);
  }, 0);

  const addService = (id: string) => {
    if (!id || serviceIds.includes(id)) return;
    setServiceIds([...serviceIds, id]);
  };
  const removeService = (id: string) => setServiceIds(serviceIds.filter(x => x !== id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serviceIds.length === 0 || !staffIdSel || !locationId || !pickedSlot) {
      toast.error("Fill service(s), provider, location, and time"); return;
    }
    setBusy(true);
    try {
      let payment: any = {};
      if (existingCard && useExistingCard) {
        payment = { stripeCustomerId: existingCard.customerId, stripePaymentMethodId: existingCard.paymentMethodId };
      } else if (collectCard) {
        if (!cardRef.current) { toast.error("Card form not ready"); setBusy(false); return; }
        try {
          const r = await cardRef.current.collect({
            email: client.email, name: `${client.firstName} ${client.lastName}`.trim(), phone: client.phone,
          });
          payment = { stripeCustomerId: r.customerId, stripePaymentMethodId: r.paymentMethodId, stripeSetupIntentId: r.setupIntentId };
        } catch (cardErr: any) {
          toast.error(cardErr?.message || "Card could not be saved"); setBusy(false); return;
        }
      }
      const { data, error } = await supabase.functions.invoke("staff-create-booking", {
        body: {
          serviceIds, staffId: staffIdSel, locationId,
          startAt: pickedSlot,
          client, ...payment, overrideConflict: canOverride && overrideConflict,
        },
      });
      // supabase-js surfaces non-2xx as `error` with `data` null. Parse the response body for the real reason.
      let errMsg: string | null = null;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            errMsg = body?.error || null;
          }
        } catch { /* ignore */ }
        errMsg = errMsg || error.message;
      } else if (data?.error) {
        errMsg = data.error;
      }
      if (errMsg) {
        const isConflict = /conflict/i.test(errMsg);
        const isOutside = /outside/i.test(errMsg);
        if ((isConflict || isOutside) && canOverride && !overrideConflict) {
          toast.error(`${errMsg} Toggle "Schedule override" above to allow it.`);
        } else {
          toast.error(errMsg);
        }
        setBusy(false); return;
      }
      toast.success("Appointment created");
      navigate(`/staff/appointments/${data.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed"); setBusy(false);
    }
  };

  const availableToAdd = services.filter(s => !serviceIds.includes(s.id));

  return (
    <div className="p-4 pb-36 sm:p-8 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3 w-3" /> Back
      </button>
      <h1 className="font-serif text-3xl mb-1">New appointment</h1>
      <p className="text-xs text-muted-foreground mb-8">Manually create an appointment for a client. Auto-approved.</p>

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Appointment</h2>

          {/* Step 1 — Services */}
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">1</span>
              <Label className="mb-0">Services {serviceIds.length > 0 && <span className="text-muted-foreground font-normal">· {totalMinutes} min total</span>}</Label>
            </div>
            {serviceIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {serviceIds.map(id => {
                  const s = services.find(x => x.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                      {s?.name ?? id} · {s?.duration_minutes}m
                      <button type="button" onClick={() => removeService(id)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mt-2">
              <select
                value=""
                onChange={(e) => addService(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{serviceIds.length === 0 ? "Select service…" : "Add another service…"}</option>
                {availableToAdd.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Add multiple services to combine into one booking.</p>
          </div>

          {/* Step 2 — Provider & Location */}
          <div className={serviceIds.length === 0 ? "opacity-50 pointer-events-none" : ""}>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">2</span>
              <Label className="mb-0">Provider & location</Label>
              {serviceIds.length === 0 && <span className="text-[11px] text-muted-foreground">— pick a service first</span>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <select required value={staffIdSel} onChange={(e) => setStaffIdSel(e.target.value)}
                  disabled={!canSeeAll || serviceIds.length === 0}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{serviceIds.length === 0 ? "Pick service first" : "Select provider…"}</option>
                  {staff.filter(s => validStaffIds.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <select required value={locationId} onChange={(e) => setLocationId(e.target.value)}
                  disabled={!staffIdSel}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{!staffIdSel ? "Pick provider first" : "Select location…"}</option>
                  {locations.filter(l => validLocIds.has(l.id)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Schedule override — admins/schedulers/receptionists only, surfaced above date/time so it pre-loads conflict slots */}
          {canOverride && (
            <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${overrideConflict ? "border-primary bg-primary/5" : "border-border bg-background/40 hover:border-primary/40"}`}>
              <Checkbox checked={overrideConflict} onCheckedChange={(v) => setOverrideConflict(!!v)} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Schedule override</div>
                <div className="text-xs text-muted-foreground">
                  Allow booking outside this provider's available hours or over an existing appointment (double-book).
                  Your role allows this — the booking will still be created and flagged in the audit log.
                </div>
              </div>
            </label>
          )}

          {/* Step 3 — Date & Time */}
          <div className={!locationId ? "opacity-50 pointer-events-none" : ""}>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">3</span>
              <Label className="mb-0">Date & time <span className="text-muted-foreground font-normal">(Pacific Time)</span></Label>
              {!locationId && <span className="text-[11px] text-muted-foreground">— pick provider & location first</span>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline"
                      disabled={!locationId}
                      className="flex-1 justify-start font-normal">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {pickedDate ? format(pickedDate, "EEE, MMM d, yyyy") : "Pick a date…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={pickedDate} onSelect={setPickedDate}
                      disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="ghost" size="sm"
                  disabled={!locationId}
                  onClick={() => setPickedDate(new Date())}
                  className="shrink-0">
                  Today
                </Button>
              </div>
              <div>
                <select required value={pickedSlot} onChange={(e) => setPickedSlot(e.target.value)}
                  disabled={!pickedDate || loadingSlots || slots.length === 0}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                  <option value="">
                    {!pickedDate ? "Pick a date first" : loadingSlots ? "Loading…" : slots.length === 0 ? (overrideConflict ? "No slots even with override" : "No availability this day") : `Select time… (${slots.length} slots${overrideConflict ? " incl. conflicts" : ""})`}
                  </option>
                  {slots.map((iso) => (
                    <option key={iso} value={iso}>
                      {new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })} PT
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>


        <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Client</h2>
          <StaffClientSearch
            value={{ firstName: client.firstName, lastName: client.lastName, email: client.email, phone: client.phone, dob: client.dob }}
            onChange={(v) => setClient((c) => ({ ...c, firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone, dob: v.dob ?? "" }))}
          />
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div><Label>First name</Label><Input required value={client.firstName} onChange={(e) => setClient({ ...client, firstName: e.target.value })} className="mt-1.5 h-11" autoComplete="given-name" /></div>
            <div><Label>Last name</Label><Input required value={client.lastName} onChange={(e) => setClient({ ...client, lastName: e.target.value })} className="mt-1.5 h-11" autoComplete="family-name" /></div>
            <div><Label>Email</Label><Input type="email" required value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} className="mt-1.5 h-11" autoComplete="email" inputMode="email" /></div>
            <div><Label>Phone (10 digits)</Label><Input required type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 000-0000" maxLength={14} value={client.phone} onChange={(e) => setClient({ ...client, phone: formatPhone10(e.target.value) })} className="mt-1.5 h-11" /></div>
            <div><Label>Date of birth</Label><Input type="date" value={client.dob} onChange={(e) => setClient({ ...client, dob: e.target.value })} className="mt-1.5 h-11" /></div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} className="mt-1.5" rows={3} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
          {existingCard ? (
            <>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={useExistingCard} onCheckedChange={(v) => setUseExistingCard(!!v)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Use card on file</div>
                  <div className="text-xs text-muted-foreground">This client has a saved card from a previous booking. Reuse it for no-show / late-cancel protection.</div>
                </div>
              </label>
              {!useExistingCard && (
                <>
                  <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-border">
                    <Checkbox checked={collectCard} onCheckedChange={(v) => setCollectCard(!!v)} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Collect a new card on file</div>
                      <div className="text-xs text-muted-foreground">Replaces the saved card for this booking.</div>
                    </div>
                  </label>
                  {collectCard && <CardOnFile ref={cardRef} ready={!!client.email && !!client.firstName} />}
                </>
              )}
            </>
          ) : (
            <>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={collectCard} onCheckedChange={(v) => setCollectCard(!!v)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Collect credit card on file</div>
                  <div className="text-xs text-muted-foreground">Saved (not charged now) and used for no-show / late-cancel fees. Uncheck to skip.</div>
                </div>
              </label>
              {collectCard && <CardOnFile ref={cardRef} ready={!!client.email && !!client.firstName} />}
            </>
          )}
        </section>

        <div className="h-28 sm:hidden" aria-hidden />
        <div className="fixed inset-x-0 bottom-[calc(3.65rem+env(safe-area-inset-bottom))] sm:static bg-background/95 backdrop-blur sm:backdrop-blur-none border-y sm:border-0 border-border p-4 sm:p-0 z-40 shadow-lg sm:shadow-none">
          <Button type="submit" disabled={busy} size="lg" className="rounded-full w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create appointment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
