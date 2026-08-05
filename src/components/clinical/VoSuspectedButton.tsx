import { useState } from "react";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = {
  clientEmail: string;
  clientFirstName?: string;
  clientLastName?: string;
  appointmentId?: string;
  locationId?: string;
  productSuspected?: string;
  region?: string;
};

const VO_STEPS = [
  { key: "stop_inject",  label: "Stop injection immediately, document time of onset", offset: 0 },
  { key: "warm_compress",label: "Apply warm compress, gentle massage", offset: 0 },
  { key: "aspirin",      label: "Aspirin 325mg PO (if no contraindication)", offset: 0 },
  { key: "nitro",        label: "Apply 2% nitroglycerin paste to affected area", offset: 0 },
  { key: "hyal_1",       label: "Hyaluronidase: high-dose pulsed (450–1500u) into ischemic territory", offset: 5 },
  { key: "photo_15",     label: "Capture photo at 15 min", offset: 15 },
  { key: "reassess_30",  label: "Reassess perfusion at 30 min — capillary refill, color, pain", offset: 30 },
  { key: "hyal_2",       label: "Repeat hyaluronidase if no improvement", offset: 60 },
  { key: "photo_60",     label: "Capture photo at 60 min", offset: 60 },
  { key: "hbo_eval",     label: "Evaluate for hyperbaric oxygen referral", offset: 90 },
  { key: "photo_120",    label: "Capture photo at 2 hr", offset: 120 },
  { key: "reassess_240", label: "Reassess at 4 hr; escalate to ER if necrosis suspected", offset: 240 },
];

export function VoSuspectedButton(props: Props) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function activate() {
    setBusy(true);
    try {
      const { user } = await authService.getSession();
      // 1. Create AE
      const { data: ae, error: aeErr } = await apiQuery("adverse_events").insert({
        client_email: props.clientEmail.toLowerCase(),
        client_first_name: props.clientFirstName,
        client_last_name: props.clientLastName,
        appointment_id: props.appointmentId ?? null,
        event_type: "vascular_occlusion",
        severity: "severe",
        outcome: "ongoing",
        product_involved: props.productSuspected ?? null,
        body_region: props.region ?? null,
        reported_by: user?.id ?? null,
      } as any).select("id").single();
      if (aeErr) throw aeErr;
      // 2. Create run
      const { data: run, error: runErr } = await apiQuery("vo_protocol_runs").insert({
        client_email: props.clientEmail.toLowerCase(),
        client_first_name: props.clientFirstName,
        client_last_name: props.clientLastName,
        ae_id: ae!.id,
        appointment_id: props.appointmentId ?? null,
        location_id: props.locationId ?? null,
        onset_at: new Date().toISOString(),
        product_suspected: props.productSuspected ?? null,
        region: props.region ?? null,
        started_by: user?.id ?? null,
      } as any).select("id").single();
      if (runErr) throw runErr;
      // 3. Seed steps
      const steps = VO_STEPS.map((s, i) => ({
        run_id: run!.id,
        step_key: s.key,
        step_label: s.label,
        due_offset_minutes: s.offset,
        sort_order: i,
      }));
      await apiQuery("vo_protocol_steps").insert(steps as any);
      // 4. Fire alert (non-blocking)
      ApiClient.post("vo-alert-oncall", {
        body: {
          run_id: run!.id,
          client_email: props.clientEmail,
          client_name: `${props.clientFirstName ?? ""} ${props.clientLastName ?? ""}`.trim(),
          region: props.region,
          product: props.productSuspected,
        },
      }).catch(() => {});
      toast.success("VO protocol activated. On-call NP notified.");
      navigate(`/staff/clinical/vo/${run!.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start protocol");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs sm:text-sm shadow-2xs justify-center border-0">
          <AlertTriangle className="h-4 w-4 mr-2" />
          VO suspected
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start vascular occlusion protocol?</AlertDialogTitle>
          <AlertDialogDescription>
            This activates the timed VO protocol for <b>{props.clientFirstName} {props.clientLastName}</b>, logs an adverse event,
            and alerts all on-call nurse practitioners by SMS and email. Use only if you suspect vascular occlusion.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={activate} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {busy ? "Starting…" : "Start protocol"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
