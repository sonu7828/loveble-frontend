import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Download, AlertTriangle, Siren
} from "lucide-react";
import hero from "@/assets/help/hero-welcome.jpg";

export default function StaffHelp() {
  useEffect(() => { try { localStorage.setItem("rka_handbook_read", "1"); } catch {} }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row gap-8 items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
            <BookOpen className="h-3.5 w-3.5" /> Staff Handbook
          </div>
          <h1 className="font-serif text-4xl md:text-5xl mb-3 leading-tight">Welcome to Radiantilyk Aesthetic.</h1>
          <p className="text-muted-foreground max-w-xl leading-relaxed">
            Your onboarding guide and day-to-day handbook. Start with <em>Know your brand</em> below to learn who we are and what we promise our clients, then jump to any workflow when you need it.
          </p>
          <a
            href="/staff-handbook.pdf"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 mt-4 text-xs uppercase tracking-wider text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF version
          </a>
        </div>
        <img src={hero} alt="Welcoming a client at the front desk" className="w-full md:w-72 rounded-2xl shadow-soft" loading="eager" width={1024} height={1024} />
      </div>

      {/* Clinical Protocols */}
      <section className="mt-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
            <Siren className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Part three</div>
            <h2 className="font-serif text-2xl md:text-3xl">Clinical protocols</h2>
          </div>
        </div>
        <p className="text-muted-foreground max-w-2xl leading-relaxed mb-8">
          Mandatory clinical reference documents. Every injector must read, sign, and keep these immediately accessible in every treatment room.
        </p>

        <div className="max-w-3xl rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.3em] text-destructive mb-1">Emergency Protocol · v1.0</div>
              <h3 className="font-serif text-xl mb-1">Vascular Occlusion — Recognition, Response & Management</h3>
              <p className="text-xs text-muted-foreground">Authors: Kiem Vukadinovic, NP (Lead Injector) · Aloysius Fobi, MD (Medical Director)</p>
            </div>
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed mb-4">
            Vascular occlusion is a <strong>time-critical medical emergency</strong> that can occur during or after any dermal filler injection. Filler entering or compressing an artery can lead to tissue necrosis, permanent scarring, blindness, or stroke. <strong>Begin hyaluronidase within 60–90 minutes</strong> for HA fillers; for periocular involvement, treat immediately.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-destructive mb-1">High-risk zones</div>
              <div className="text-xs text-foreground/80">Glabella · Nose · Nasolabial fold · Deep forehead</div>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-warning-soft-foreground mb-1">Moderate-risk zones</div>
              <div className="text-xs text-foreground/80">Temple · Lips · Cheek/midface · Chin</div>
            </div>
          </div>

          <div className="rounded-lg bg-card border border-border p-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-primary mb-2">Emergency response — at a glance</div>
            <ol className="space-y-1.5 text-sm text-foreground/80">
              <li><strong>1. Recognize</strong> — disproportionate pain, blanching, livedo, delayed cap refill. Say it aloud.</li>
              <li><strong>2. Stop &amp; notify</strong> — stop injecting, alert the team, call the Medical Director.</li>
              <li><strong>3. Warm compress + massage</strong> the affected territory.</li>
              <li><strong>4. Hyaluronidase</strong> (HA fillers) — flood the entire vascular distribution, 10–30 units per site, repeat every 60 min until reperfusion.</li>
              <li><strong>5. Adjuncts</strong> — aspirin 325 mg, NTG paste (per MD), antibiotics if skin compromise.</li>
              <li><strong>6. Reassess</strong> at 60 min — color, cap refill, pain.</li>
              <li><strong>7. Follow up</strong> at 24h / 48h / 72h / 1 wk · photograph · plastics if necrosis.</li>
            </ol>
          </div>

          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 mb-4">
            <div className="text-xs font-medium text-destructive mb-1">⚠ Vision symptoms = call 911 immediately</div>
            <div className="text-xs text-foreground/80">Sudden vision loss, eye pain, severe one-sided headache, facial droop, slurred speech, or altered mental status — activate EMS and state: <em>"vascular emergency, possible filler embolism."</em></div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <a href="/handbook/Vascular_Occlusion_Protocol.docx" download>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download full protocol (20 pages)
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <a href="/handbook/Vascular_Occlusion_Protocol.docx" target="_blank" rel="noopener">
                Open in new tab
              </a>
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground mt-4 italic">
            This summary is for quick reference only and does not replace the full protocol. Every injector must read the complete document, sign the acknowledgment page, and re-review at minimum annually.
          </p>
        </div>

        {/* Device & treatment manuals */}
        <div className="max-w-3xl mt-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Device & treatment manuals</div>
          <p className="text-sm text-muted-foreground mb-4">
            Manufacturer IFUs and internal staff guides for every device in the clinic. Read before operating; keep accessible in-room during treatment.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { title: "Geneo — User Manual", desc: "OxyPod facial system · operation, settings, maintenance", href: "/handbook/Geneo_User_Manual.pdf" },
              { title: "Ultherapy Prime — IFU", desc: "Manufacturer instructions for use (Merz)", href: "/handbook/Ultherapy_Prime_IFU.pdf" },
              { title: "HIFU / Ultherapy — Staff Manual", desc: "Comprehensive staff instruction & treatment guide", href: "/handbook/HIFU_Ultherapy_Staff_Manual.pdf" },
              { title: "CO₂ Laser — Staff Manual", desc: "Pre-op, settings, safety, post-op protocol", href: "/handbook/CO2_Laser_Staff_Manual.pdf" },
              { title: "BTL Exilis Ultra 360 — Staff Guide", desc: "Treatment parameters, body & face protocols", href: "/handbook/BTL_Exilis_Ultra_360_Staff_Guide.pdf" },
            ].map((m) => (
              <div key={m.href} className="rounded-xl border border-border bg-card p-4 flex flex-col">
                <div className="font-medium text-sm mb-1">{m.title}</div>
                <div className="text-xs text-muted-foreground mb-3 flex-1">{m.desc}</div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <a href={m.href} target="_blank" rel="noopener">Open</a>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="rounded-full">
                    <a href={m.href} download><Download className="h-3.5 w-3.5 mr-1.5" />Download</a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="mt-20 pt-8 border-t border-border text-center text-xs text-muted-foreground">
        Radiantilyk Aesthetic · Staff Handbook · v1.0 · Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </div>
    </div>
  );
}
