import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CheckCircle2, Sparkles, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ModelFormData {
  name: string;
  email: string;
  phone: string;
  dob: string;
  city: string;
  instagram: string;
  howDidYouHear: string;
  ageConfirm: boolean;
  skinType: string;
  pregnancyStatus: string;
  medications: string;
  allergies: string;
  previousTreatments: string;
  treatmentInterest: string;
  availability: string;
  reasonForModeling: string;
  photoReleaseMain: boolean;
  consentModelRelease: boolean;
  consentFinancial: boolean;
  consentRiskAndTerms: boolean;
  consentHipaa: boolean;
  signatureName: string;
  signatureDate: string;
}

export default function Model() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ModelFormData>({
    name: "",
    email: "",
    phone: "",
    dob: "",
    city: "",
    instagram: "",
    howDidYouHear: "",
    ageConfirm: false,
    skinType: "",
    pregnancyStatus: "no",
    medications: "",
    allergies: "",
    previousTreatments: "",
    treatmentInterest: "",
    availability: "",
    reasonForModeling: "",
    photoReleaseMain: false,
    consentModelRelease: false,
    consentFinancial: false,
    consentRiskAndTerms: false,
    consentHipaa: false,
    signatureName: "",
    signatureDate: "",
  });

  const updateField = (field: keyof ModelFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Model application submitted successfully! Our team will review and reach out.");
    }, 1200);
  };

  const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 border-b border-border/60 pb-2 mb-4">
      <Icon className="h-4.5 w-4.5 text-primary shrink-0" strokeWidth={1.75} />
      <h2 className="font-serif text-lg md:text-xl font-semibold tracking-tight text-foreground">{title}</h2>
    </div>
  );

  const FormLabel = ({ htmlFor, children }: { htmlFor?: string, children: React.ReactNode }) => (
    <Label htmlFor={htmlFor} className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
      {children}
    </Label>
  );

  const inputClass = "h-10 rounded-xl bg-card border-border/80 text-xs sm:text-sm shadow-2xs focus-visible:ring-2 focus-visible:ring-primary/30 transition";
  const textareaClass = "min-h-[70px] rounded-xl bg-card border-border/80 text-xs sm:text-sm shadow-2xs focus-visible:ring-2 focus-visible:ring-primary/30 resize-y p-3 transition";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Main Container — Middle 90% Width */}
      <main className="flex-1 w-[95%] xl:w-[90%] max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-20">

        {/* Hero Section */}
        <div className="text-center mb-8 space-y-2">
          <Badge variant="outline" className="uppercase tracking-[0.25em] text-[10px] font-semibold border-primary/30 bg-primary/10 text-primary px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3 mr-1 inline" /> Model Program
          </Badge>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground tracking-tight font-semibold">
            Model Application
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Receive complimentary or significantly reduced treatments in exchange for marketing photos & videos. All treatments performed by licensed medical professionals.
          </p>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. About You */}
          <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <SectionHeader icon={Users} title="1. Personal Information" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <FormLabel htmlFor="name">Full Name *</FormLabel>
                <Input id="name" required className={inputClass} value={formData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Jane Doe" />
              </div>
              <div>
                <FormLabel htmlFor="dob">Date of Birth *</FormLabel>
                <Input id="dob" type="date" required className={inputClass} value={formData.dob} onChange={(e) => updateField("dob", e.target.value)} />
              </div>
              <div>
                <FormLabel htmlFor="email">Email Address *</FormLabel>
                <Input id="email" type="email" required className={inputClass} value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="jane@example.com" />
              </div>
              <div>
                <FormLabel htmlFor="phone">Phone Number *</FormLabel>
                <Input id="phone" type="tel" required className={inputClass} value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="(408) 555-0123" />
              </div>
              <div>
                <FormLabel htmlFor="city">City / Neighborhood</FormLabel>
                <Input id="city" className={inputClass} placeholder="San Jose, CA" value={formData.city} onChange={(e) => updateField("city", e.target.value)} />
              </div>
              <div>
                <FormLabel htmlFor="instagram">Instagram Handle</FormLabel>
                <Input id="instagram" className={inputClass} placeholder="@yourhandle" value={formData.instagram} onChange={(e) => updateField("instagram", e.target.value)} />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex items-center space-x-2.5">
              <Checkbox id="age-confirm" required className="rounded-md h-4 w-4" checked={formData.ageConfirm} onCheckedChange={(checked) => updateField("ageConfirm", checked as boolean)} />
              <Label htmlFor="age-confirm" className="text-xs font-medium cursor-pointer text-foreground">
                I confirm I am 18 years of age or older. *
              </Label>
            </div>
          </section>

          {/* 2. Health Screening */}
          <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <SectionHeader icon={CheckCircle2} title="2. Health & Medical Screening" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <FormLabel>Fitzpatrick Skin Type (If Known)</FormLabel>
                <Select value={formData.skinType} onValueChange={(value) => updateField("skinType", value)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select skin type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="type-1">I – Very fair, always burns</SelectItem>
                    <SelectItem value="type-2">II – Fair, usually burns</SelectItem>
                    <SelectItem value="type-3">III – Medium, sometimes burns</SelectItem>
                    <SelectItem value="type-4">IV – Olive, rarely burns</SelectItem>
                    <SelectItem value="type-5">V – Brown, very rarely burns</SelectItem>
                    <SelectItem value="type-6">VI – Dark brown / black, never burns</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <FormLabel>Pregnant or Breastfeeding? *</FormLabel>
                <RadioGroup value={formData.pregnancyStatus} onValueChange={(value) => updateField("pregnancyStatus", value)} className="flex flex-row gap-6 h-10 items-center">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="preg-no" className="h-4 w-4" />
                    <Label htmlFor="preg-no" className="text-xs font-medium cursor-pointer">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="preg-yes" className="h-4 w-4" />
                    <Label htmlFor="preg-yes" className="text-xs font-medium cursor-pointer">Yes</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormLabel htmlFor="medications">Current Medications</FormLabel>
                <Textarea id="medications" className={textareaClass} placeholder="List any medications..." value={formData.medications} onChange={(e) => updateField("medications", e.target.value)} />
              </div>
              <div>
                <FormLabel htmlFor="allergies">Known Allergies</FormLabel>
                <Textarea id="allergies" className={textareaClass} placeholder="Lidocaine, latex, etc." value={formData.allergies} onChange={(e) => updateField("allergies", e.target.value)} />
              </div>
              <div>
                <FormLabel htmlFor="previous">Previous Treatments</FormLabel>
                <Textarea id="previous" className={textareaClass} placeholder="Botox 3 months ago, etc." value={formData.previousTreatments} onChange={(e) => updateField("previousTreatments", e.target.value)} />
              </div>
            </div>
          </section>

          {/* 3. Treatments & Availability */}
          <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <SectionHeader icon={Sparkles} title="3. Treatment Interests" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor="treatment-interest">Desired Treatment(s) *</FormLabel>
                <Textarea id="treatment-interest" required className={textareaClass} placeholder="Botox, Lip Filler, RF Microneedling, Chemical Peel..." value={formData.treatmentInterest} onChange={(e) => updateField("treatmentInterest", e.target.value)} />
              </div>
              <div>
                <FormLabel htmlFor="availability">Days / Times Available</FormLabel>
                <Textarea id="availability" className={textareaClass} placeholder="Weekdays afternoons, Saturdays..." value={formData.availability} onChange={(e) => updateField("availability", e.target.value)} />
              </div>
            </div>
          </section>

          {/* 4. Model Release & Consents */}
          <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
            <SectionHeader icon={CheckCircle2} title="4. Model Consents & Media Release" />

            <div className="space-y-3 text-xs">
              <div className="flex items-start space-x-3 p-3 rounded-xl border border-border/60 bg-background/50">
                <Checkbox id="consent-photo" required className="mt-0.5 rounded-md h-4 w-4" checked={formData.photoReleaseMain} onCheckedChange={(checked) => updateField("photoReleaseMain", checked as boolean)} />
                <Label htmlFor="consent-photo" className="font-normal cursor-pointer leading-relaxed">
                  I grant Radiantilyk Aesthetic permission to take photos and videos before, during, and after my treatment for social media, website, and marketing purposes. *
                </Label>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-xl border border-border/60 bg-background/50">
                <Checkbox id="consent-terms" required className="mt-0.5 rounded-md h-4 w-4" checked={formData.consentRiskAndTerms} onCheckedChange={(checked) => updateField("consentRiskAndTerms", checked as boolean)} />
                <Label htmlFor="consent-terms" className="font-normal cursor-pointer leading-relaxed">
                  I understand that model treatments are provided at a reduced rate in exchange for media usage, and I agree to follow pre/post treatment instructions provided by the medical staff. *
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <FormLabel htmlFor="sig-name">Digital Signature (Full Name) *</FormLabel>
                <Input id="sig-name" required className={inputClass} placeholder="Type your full legal name" value={formData.signatureName} onChange={(e) => updateField("signatureName", e.target.value)} />
              </div>
              <div>
                <FormLabel htmlFor="sig-date">Signature Date *</FormLabel>
                <Input id="sig-date" type="date" required className={inputClass} value={formData.signatureDate} onChange={(e) => updateField("signatureDate", e.target.value)} />
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-center pt-2">
            <Button type="submit" disabled={loading} size="lg" className="rounded-full px-10 font-semibold shadow-md">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  Submit Application <Send className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </main>

      <SiteFooter />
    </div>
  );
}
