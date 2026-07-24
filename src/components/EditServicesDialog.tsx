import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  staffId: string;
  locationId: string;
  startAt: string;
  currentServiceId: string;
  onSaved: () => void;
}

interface SvcRow { id: string; name: string; duration_minutes: number; buffer_minutes: number; }

export function EditServicesDialog({
  open, onOpenChange, appointmentId, staffId, locationId, startAt, currentServiceId, onSaved,
}: Props) {
  const [allServices, setAllServices] = useState<SvcRow[]>([]);
  const [providers, setProviders] = useState<{ service_id: string; staff_id: string; location_id: string }[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickAdd, setPickAdd] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("services").select("id, name, duration_minutes, buffer_minutes").eq("is_active", true).order("name"),
      supabase.from("service_providers").select("service_id, staff_id, location_id"),
      supabase.from("appointment_services").select("service_id, display_order").eq("appointment_id", appointmentId).order("display_order"),
    ]).then(([s, p, a]) => {
      setAllServices((s.data ?? []) as SvcRow[]);
      setProviders((p.data ?? []) as any);
      const existing = (a.data ?? []).map((r: any) => r.service_id as string);
      setServiceIds(existing.length ? existing : [currentServiceId]);
      setPickAdd("");
      setLoading(false);
    });
  }, [open, appointmentId, currentServiceId]);

  // Only services this provider offers at this location
  const offered = useMemo(() => {
    const ids = new Set(
      providers.filter(p => p.staff_id === staffId && p.location_id === locationId).map(p => p.service_id)
    );
    return allServices.filter(s => ids.has(s.id));
  }, [allServices, providers, staffId, locationId]);

  const totalMinutes = useMemo(() => {
    let mins = 0;
    serviceIds.forEach((id, idx) => {
      const s = allServices.find(x => x.id === id);
      if (!s) return;
      mins += s.duration_minutes;
      if (idx === serviceIds.length - 1) mins += s.buffer_minutes ?? 0;
    });
    return mins;
  }, [serviceIds, allServices]);

  const addService = (id: string) => {
    if (!id || serviceIds.includes(id)) return;
    setServiceIds([...serviceIds, id]);
    setPickAdd("");
  };
  const removeService = (id: string) => {
    if (serviceIds.length === 1) { toast.error("Appointment needs at least one service"); return; }
    setServiceIds(serviceIds.filter(x => x !== id));
  };

  const save = async () => {
    if (serviceIds.length === 0) return;
    setBusy(true);
    try {
      const primaryId = serviceIds[0];
      const start = new Date(startAt);
      const end = new Date(start.getTime() + totalMinutes * 60000);

      // Pre-check overlap with other appointments for same provider
      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, client_first_name, client_last_name")
        .eq("staff_id", staffId)
        .in("status", ["pending", "approved"])
        .neq("id", appointmentId)
        .lt("start_at", end.toISOString())
        .gt("end_at", start.toISOString())
        .limit(1);

      let useOverride = false;
      if (conflicts && conflicts.length > 0) {
        const c: any = conflicts[0];
        const t = new Date(c.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const name = [c.client_first_name, c.client_last_name].filter(Boolean).join(" ") || "another client";
        const ok = window.confirm(
          `This will overlap ${name} at ${t} on ${name === "another client" ? "" : "the same provider's schedule"}.\n\nDouble-book anyway?`
        );
        if (!ok) { setBusy(false); return; }
        useOverride = true;
      }

      if (useOverride) {
        const { error: fErr } = await supabase.rpc("update_appointment_end_force", {
          p_appointment_id: appointmentId,
          p_end_at: end.toISOString(),
          p_service_id: primaryId,
        });
        if (fErr) throw fErr;
      } else {
        const { error: aErr } = await supabase
          .from("appointments")
          .update({
            service_id: primaryId,
            end_at: end.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointmentId);
        if (aErr) throw aErr;
      }



      // Replace appointment_services rows
      await supabase.from("appointment_services").delete().eq("appointment_id", appointmentId);
      const rows = serviceIds.map((sid, idx) => {
        const s = allServices.find(x => x.id === sid);
        return {
          appointment_id: appointmentId,
          service_id: sid,
          display_order: idx,
          duration_minutes: s?.duration_minutes ?? 0,
        };
      });
      const { error: asErr } = await supabase.from("appointment_services").insert(rows);
      if (asErr) throw asErr;

      // Auto-assign service-specific consents (don't remove existing; idempotent)
      const { data: links } = await supabase
        .from("service_consents")
        .select("consent_form_id, service_id, consent_forms(is_active)")
        .in("service_id", serviceIds);
      const formIds = Array.from(new Set(
        (links ?? [])
          .filter((l: any) => l.consent_forms?.is_active)
          .map((l: any) => l.consent_form_id as string)
      ));
      if (formIds.length) {
        const { data: existing } = await supabase
          .from("appointment_consents")
          .select("consent_form_id")
          .eq("appointment_id", appointmentId);
        const have = new Set((existing ?? []).map((r: any) => r.consent_form_id));
        const toInsert = formIds
          .filter(fid => !have.has(fid))
          .map(fid => ({ appointment_id: appointmentId, consent_form_id: fid }));
        if (toInsert.length) {
          await supabase.from("appointment_consents").insert(toInsert);
        }
      }

      await supabase.from("appointment_audit_log").insert({
        appointment_id: appointmentId,
        action: "services_updated",
        notes: `Services updated to: ${serviceIds.map(id => allServices.find(s => s.id === id)?.name).filter(Boolean).join(", ")} (${totalMinutes} min)`,
      });

      // Re-sync calendar event with new times/title (fire-and-forget)
      supabase.functions.invoke("google-calendar-sync", { body: { appointmentId } }).catch(() => {});

      toast.success("Services updated");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update services");
    } finally {
      setBusy(false);
    }
  };

  const addable = offered.filter(s => !serviceIds.includes(s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit services</DialogTitle>
          <DialogDescription>
            Add, remove, or change services. End time will adjust automatically.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Selected · {totalMinutes} min total
              </div>
              <div className="space-y-2">
                {serviceIds.map((id, idx) => {
                  const s = allServices.find(x => x.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                      <div className="text-sm">
                        {s?.name ?? "Unknown service"}
                        {idx === 0 && <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">Primary</span>}
                        <span className="text-xs text-muted-foreground ml-2">{s?.duration_minutes ?? 0} min</span>
                      </div>
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removeService(id)}
                        disabled={serviceIds.length === 1}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {addable.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Plus className="h-3 w-3" /> Add a service
                </div>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={pickAdd}
                  onChange={(e) => addService(e.target.value)}
                >
                  <option value="">Select a service…</option>
                  {addable.map(s => (
                    <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Only services this provider offers at this location are listed.
                </p>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
              Note: This won't re-check availability for the new total duration. Required consent forms for any added services will be auto-attached.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || loading || serviceIds.length === 0}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
