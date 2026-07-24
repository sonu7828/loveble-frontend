import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarPlus, MapPin, Bell, ListChecks, Loader2 } from "lucide-react";

// ------- Calendar helpers -------
function pad(n: number) { return n.toString().padStart(2, "0"); }
function toICSDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

interface CalendarBlockProps {
  title: string;
  startAt: string;
  endAt: string;
  locationLine: string;
  details: string;
}

export function CalendarAndMap({
  title, startAt, endAt, locationLine, details, mapsQuery,
}: CalendarBlockProps & { mapsQuery: string }) {
  const start = new Date(startAt);
  const end = new Date(endAt || startAt);
  const gcalUrl = `https://www.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${toICSDate(start)}/${toICSDate(end)}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(locationLine)}`;

  const downloadIcs = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Radiantilyk Aesthetic//Booking//EN",
      "BEGIN:VEVENT",
      `UID:${start.getTime()}@bookrka.com`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${title}`,
      `LOCATION:${locationLine.replace(/\n/g, ", ")}`,
      `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "radiantilyk-appointment.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a href={gcalUrl} target="_blank" rel="noopener noreferrer">
            <CalendarPlus className="h-4 w-4 mr-1.5" /> Add to Google Calendar
          </a>
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" onClick={downloadIcs}>
          <CalendarPlus className="h-4 w-4 mr-1.5" /> Apple / Outlook (.ics)
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a href={mapHref} target="_blank" rel="noopener noreferrer">
            <MapPin className="h-4 w-4 mr-1.5" /> Get directions
          </a>
        </Button>
      </div>
    </div>
  );
}

// ------- Reminders preview -------
export function RemindersPreview() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-lg">Reminders</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        So nothing falls through the cracks, we'll automatically reach out:
      </p>
      <ul className="text-sm space-y-2">
        <li className="flex gap-3">
          <span className="inline-flex shrink-0 items-center justify-center h-6 w-16 rounded-full bg-secondary text-[11px] uppercase tracking-wider text-foreground/70">48h</span>
          <span>Email reminder with pre-visit instructions and your manage-appointment link.</span>
        </li>
        <li className="flex gap-3">
          <span className="inline-flex shrink-0 items-center justify-center h-6 w-16 rounded-full bg-secondary text-[11px] uppercase tracking-wider text-foreground/70">24h</span>
          <span>Text message reminder to the phone on your booking.</span>
        </li>
        <li className="flex gap-3">
          <span className="inline-flex shrink-0 items-center justify-center h-6 w-16 rounded-full bg-primary/15 text-[11px] uppercase tracking-wider text-primary">2h</span>
          <span>Short text confirming your appointment time and location.</span>
        </li>
      </ul>
      <p className="text-[11px] text-muted-foreground mt-4">
        Reply STOP to any text to opt out. Need to change anything? Use Reschedule or Cancel above.
      </p>
    </div>
  );
}

// ------- Pre-visit checklist (from service_pre_op_instructions) -------
interface PreOpRow { service_id: string; title: string; body_markdown: string }

export function PreVisitChecklist({ serviceIds, serviceNames }: { serviceIds: string[]; serviceNames: Record<string, string> }) {
  const [rows, setRows] = useState<PreOpRow[] | null>(null);
  useEffect(() => {
    if (!serviceIds.length) { setRows([]); return; }
    supabase.from("service_pre_op_instructions")
      .select("service_id, title, body_markdown")
      .in("service_id", serviceIds)
      .then(({ data }) => setRows((data ?? []).filter((r: any) => (r.body_markdown ?? "").trim()) as PreOpRow[]));
  }, [serviceIds.join(",")]);

  if (rows === null) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pre-visit instructions…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-lg">Before your visit</h3>
        </div>
        <ul className="text-sm space-y-1.5 text-foreground/80">
          <li>• Avoid alcohol for 24 hours before your visit.</li>
          <li>• Arrive with clean skin (no makeup) when possible.</li>
          <li>• Eat a light meal beforehand and stay hydrated.</li>
          <li>• Arrive 5 minutes early to settle in.</li>
        </ul>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-lg">Before your visit</h3>
      </div>
      <div className="space-y-5">
        {rows.map((r) => (
          <div key={r.service_id}>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {serviceNames[r.service_id] ?? "Treatment"}
            </div>
            <MarkdownLite text={r.body_markdown} />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-4">
        Questions? Text or call <a href="tel:4083511873" className="underline">408-351-1873</a>.
      </p>
    </div>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: string) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`u${k}`} className="list-disc pl-5 space-y-1 text-sm text-foreground/80 mb-3">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flush(`b${i}`); return; }
    if (line.startsWith("### ")) { flush(`b${i}`); out.push(<div key={i} className="text-sm font-semibold mt-3 mb-1">{line.slice(4)}</div>); return; }
    if (line.startsWith("## ")) { flush(`b${i}`); out.push(<div key={i} className="text-base font-serif mt-4 mb-2">{line.slice(3)}</div>); return; }
    if (line.startsWith("- ")) { bullets.push(line.slice(2)); return; }
    flush(`b${i}`);
    out.push(<p key={i} className="text-sm text-foreground/80 mb-2">{line}</p>);
  });
  flush("end");
  return <>{out}</>;
}
