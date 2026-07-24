import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MiniSignaturePad } from "@/components/clinical/MiniSignaturePad";
import { usePageMeta } from "@/hooks/usePageMeta";

type Protocol = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  body_markdown: string;
  version: number;
  renewal_months: number;
  requires_license: boolean;
  sections: { id: string; title: string; body: string }[];
};

export default function ComplianceSign() {
  const { protocolId } = useParams();
  const nav = useNavigate();
  usePageMeta({ title: "Sign protocol · Radiantilyk Aesthetic" });

  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [staffProfile, setStaffProfile] = useState<{ id: string; full_name: string; license_number: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [initials, setInitials] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("CA");
  const [signaturePng, setSignaturePng] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { nav("/staff/login"); return; }

      const [{ data: p }, { data: sp }] = await Promise.all([
        supabase.from("compliance_protocols").select("*").eq("id", protocolId).maybeSingle(),
        supabase.from("staff_profiles").select("id, full_name, license_number").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!p) { toast.error("Protocol not found"); nav("/staff/compliance"); return; }
      setProtocol(p as unknown as Protocol);
      setStaffProfile(sp as any);
      if (sp?.full_name) setFullName(sp.full_name);
      if (sp?.license_number) setLicenseNumber(sp.license_number);
      setLoading(false);
    })();
  }, [protocolId, nav]);

  const sections = protocol?.sections ?? [];
  const allInitialed = useMemo(
    () => sections.length > 0 && sections.every((s) => (initials[s.id] || "").trim().length >= 2),
    [sections, initials],
  );
  const canSubmit = allInitialed && fullName.trim().length >= 3 && signaturePng && confirmed && (!protocol?.requires_license || licenseNumber.trim().length > 0);

  async function submit() {
    if (!protocol || !staffProfile) return;
    if (!canSubmit) { toast.error("Complete all initials, name, signature, and confirmation."); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Best-effort IP capture
      let ip = "";
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        const j = await r.json();
        ip = j.ip || "";
      } catch (_e) { /* ignore */ }

      // Hash protocol body for tamper-evidence
      const enc = new TextEncoder().encode(protocol.body_markdown);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const bodyHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: sig, error } = await supabase
        .from("compliance_signatures")
        .insert({
          protocol_id: protocol.id,
          protocol_version: protocol.version,
          protocol_slug: protocol.slug,
          protocol_title: protocol.title,
          staff_id: staffProfile.id,
          staff_user_id: user.id,
          signed_full_name: fullName.trim(),
          license_number: licenseNumber.trim() || null,
          license_state: licenseState.trim() || null,
          signature_png: signaturePng,
          section_initials: initials,
          body_sha256: bodyHash,
          ip_address: ip || null,
          user_agent: navigator.userAgent.slice(0, 500),
        })
        .select("id")
        .single();

      if (error || !sig) throw new Error(error?.message || "Could not save signature");

      // Generate PDF in background
      supabase.functions.invoke("generate-compliance-pdf", { body: { signatureId: sig.id } }).then(({ error: e }) => {
        if (e) console.error("PDF gen failed", e);
      });

      toast.success("Signed. A copy is being saved to your profile.");
      nav("/staff/compliance");
    } catch (e: any) {
      toast.error(e?.message || "Could not submit signature");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !protocol) {
    return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <Button variant="ghost" size="sm" onClick={() => nav("/staff/compliance")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
      </Button>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{protocol.category} · v{protocol.version}</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{protocol.title}</h1>
        {protocol.summary && <p className="text-sm text-muted-foreground mt-2">{protocol.summary}</p>}
        <p className="text-xs text-muted-foreground mt-2">
          Practice: Radiantilyk Aesthetic · Medical Director: Aloysius N. Fobi, MD · Renews every {protocol.renewal_months} months
        </p>
      </div>

      {sections.map((s, i) => (
        <Card key={s.id} className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="font-medium text-base">Section {i + 1}. {s.title}</div>
            <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{s.body}</div>
            <div className="pt-2 border-t border-border/50">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Initial here to acknowledge this section *</Label>
              <Input
                value={initials[s.id] || ""}
                onChange={(e) => setInitials((p) => ({ ...p, [s.id]: e.target.value.toUpperCase().slice(0, 4) }))}
                placeholder="e.g. KV"
                className="mt-1.5 h-11 max-w-[140px] uppercase tracking-widest font-medium"
                maxLength={4}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-4">
          <div className="font-medium text-base">Final Attestation & Signature</div>
          <p className="text-sm leading-relaxed">
            I have read, understood, and agree to follow this protocol in its entirety. I understand that deviation may result in disciplinary action up to and including termination and reporting to the appropriate licensing board. My typed name, drawn signature, license number, IP address, and timestamp constitute my legal electronic signature under E-SIGN and UETA.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {protocol.requires_license && (
              <>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">License number *</Label>
                  <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">State</Label>
                  <Input value={licenseState} onChange={(e) => setLicenseState(e.target.value.toUpperCase().slice(0, 2))} className="mt-1.5 h-11" />
                </div>
              </>
            )}
          </div>

          <MiniSignaturePad
            fullName={fullName}
            onFullNameChange={setFullName}
            signaturePng={signaturePng}
            onSignatureChange={setSignaturePng}
            nameLabel="Type your full legal name *"
            label="Draw your signature *"
          />

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(!!c)} className="mt-0.5" />
            <span>I confirm I am {staffProfile?.full_name || "the named staff member"}, this is my legal electronic signature, and I have authority to sign on my own behalf.</span>
          </label>

          {!allInitialed && (
            <p className="text-xs text-amber-700">Initial every section above before submitting.</p>
          )}

          <Button onClick={submit} disabled={!canSubmit || submitting} className="w-full h-12 text-base">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><ShieldCheck className="h-4 w-4 mr-2" /> Submit signed protocol</>)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
