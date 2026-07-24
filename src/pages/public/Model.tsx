import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CheckCircle2, Sparkles, Camera, Loader2, Sun, Video, Image, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ModelFormData {
  // About You
  name: string;
  email: string;
  phone: string;
  dob: string;
  city: string;
  instagram: string;
  howDidYouHear: string;
  ageConfirm: boolean;

  // Health Screening
  skinType: string;
  pregnancyStatus: string;
  medications: string;
  allergies: string;
  previousTreatments: string;

  // Treatment
  treatmentInterest: string;
  availability: string;
  reasonForModeling: string;

  // Consents
  photoReleaseMain: boolean;
  consentModelRelease: boolean;
  consentFinancial: boolean;
  consentRiskAndTerms: boolean;
  consentHipaa: boolean;

  // Signature
  signatureName: string;
  signatureDate: string;
}

export default function Model() {
  const [loading, setLoading] = useState(false);
  const [expandedConsent, setExpandedConsent] = useState<Record<string, boolean>>({});
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

  const toggleConsent = (key: string) => {
    setExpandedConsent(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Application submitted successfully! We will be in touch soon.");
    }, 1500);
  };

  const SectionHeader = ({ icon: Icon, title, iconClass = "text-primary" }: { icon: any, title: string, iconClass?: string }) => (
    <div className="flex items-center gap-2 border-b border-border pb-2 mb-3">
      <Icon className={`h-4 w-4 ${iconClass}`} strokeWidth={1.5} />
      <h2 className="font-serif text-lg md:text-xl tracking-wide text-foreground font-medium">{title}</h2>
    </div>
  );

  const FormLabel = ({ htmlFor, children }: { htmlFor?: string, children: React.ReactNode }) => (
    <Label htmlFor={htmlFor} className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">
      {children}
    </Label>
  );

  const inputClass = "h-9 rounded-md bg-transparent border-border text-xs shadow-xs transition-colors focus-visible:ring-1 focus-visible:ring-primary";
  const textareaClass = "min-h-[56px] rounded-md bg-transparent border-border text-xs shadow-xs transition-colors focus-visible:ring-1 focus-visible:ring-primary resize-y py-2";

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <SiteHeader />

      <main className="flex-1 py-6 md:py-8">
        <div className="container max-w-2xl px-4 mx-auto">

          {/* Header Section */}
          <div className="text-center mb-6 space-y-2">
            <Badge variant="outline" className="uppercase tracking-[0.2em] text-[9px] font-medium border-primary/30 bg-primary/5 text-primary px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-2.5 h-2.5 mr-1 inline" /> Model Program
            </Badge>
            <h1 className="font-serif text-2xl md:text-3xl text-foreground tracking-tight font-normal">Become a model</h1>
            <p className="text-muted-foreground text-xs md:text-sm max-w-[480px] mx-auto leading-normal">
              Receive complimentary or significantly reduced treatments in exchange for photos and videos for marketing. All treatments performed by trained medical staff.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* 1. About you */}
            <section className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 shadow-2xs">
              <SectionHeader icon={Users} title="1. About you" iconClass="text-[#8B6B5D]" />

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FormLabel htmlFor="name">Full name *</FormLabel>
                    <Input id="name" required className={inputClass} value={formData.name} onChange={(e) => updateField("name", e.target.value)} />
                  </div>
                  <div>
                    <FormLabel htmlFor="dob">Date of birth *</FormLabel>
                    <Input id="dob" type="date" required className={inputClass} value={formData.dob} onChange={(e) => updateField("dob", e.target.value)} />
                  </div>

                  <div>
                    <FormLabel htmlFor="email">Email *</FormLabel>
                    <Input id="email" type="email" required className={inputClass} value={formData.email} onChange={(e) => updateField("email", e.target.value)} />
                  </div>
                  <div>
                    <FormLabel htmlFor="phone">Phone *</FormLabel>
                    <Input id="phone" type="tel" required className={inputClass} value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} />
                  </div>

                  <div>
                    <FormLabel htmlFor="city">City / neighborhood</FormLabel>
                    <Input id="city" className={inputClass} placeholder="San Jose, CA" value={formData.city} onChange={(e) => updateField("city", e.target.value)} />
                  </div>
                  <div>
                    <FormLabel htmlFor="instagram">Instagram handle</FormLabel>
                    <Input id="instagram" className={inputClass} placeholder="@yourhandle" value={formData.instagram} onChange={(e) => updateField("instagram", e.target.value)} />
                  </div>

                  <div className="sm:col-span-2">
                    <FormLabel htmlFor="heard-from">How did you hear about us?</FormLabel>
                    <Input id="heard-from" className={inputClass} placeholder="Instagram, friend, Google..." value={formData.howDidYouHear} onChange={(e) => updateField("howDidYouHear", e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 pt-1">
                  <Checkbox id="age-confirm" required className="rounded-sm h-4 w-4" checked={formData.ageConfirm} onCheckedChange={(checked) => updateField("ageConfirm", checked as boolean)} />
                  <Label htmlFor="age-confirm" className="text-xs font-normal cursor-pointer text-muted-foreground">
                    I confirm I am 18 years of age or older. *
                  </Label>
                </div>
              </div>
            </section>

            {/* 2. Health screening */}
            <section className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 shadow-2xs">
              <SectionHeader icon={CheckCircle2} title="2. Health screening" iconClass="text-[#8B6B5D]" />

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <FormLabel>Pregnant or breastfeeding? *</FormLabel>
                    <RadioGroup value={formData.pregnancyStatus} onValueChange={(value) => updateField("pregnancyStatus", value)} className="flex flex-row gap-5 h-9 items-center">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="preg-no" className="h-3.5 w-3.5" />
                        <Label htmlFor="preg-no" className="text-xs font-normal cursor-pointer">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="preg-yes" className="h-3.5 w-3.5" />
                        <Label htmlFor="preg-yes" className="text-xs font-normal cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <FormLabel htmlFor="medications">Current medications</FormLabel>
                    <Textarea id="medications" className={textareaClass} placeholder='Rx / OTC, or "None"' value={formData.medications} onChange={(e) => updateField("medications", e.target.value)} />
                  </div>

                  <div>
                    <FormLabel htmlFor="allergies">Known allergies</FormLabel>
                    <Textarea id="allergies" className={textareaClass} placeholder='Latex, lidocaine, or "None"' value={formData.allergies} onChange={(e) => updateField("allergies", e.target.value)} />
                  </div>

                  <div>
                    <FormLabel htmlFor="treatments">Treatments (last 6 mo)</FormLabel>
                    <Textarea id="treatments" className={textareaClass} placeholder="e.g. Botox 3mo ago" value={formData.previousTreatments} onChange={(e) => updateField("previousTreatments", e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Treatment preferences */}
            <section className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 shadow-2xs">
              <SectionHeader icon={Sparkles} title="3. Treatment preferences" iconClass="text-[#8B6B5D]" />

              <div className="space-y-3">
                <div>
                  <FormLabel>Requested Service *</FormLabel>
                  <Select required value={formData.treatmentInterest} onValueChange={(value) => updateField("treatmentInterest", value)}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Choose treatment interest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neurotoxin">Neurotoxin (Botox / Dysport / Xeomin)</SelectItem>
                      <SelectItem value="filler">Filler</SelectItem>
                      <SelectItem value="sculptra">Sculptra / Bio-stimulator</SelectItem>
                      <SelectItem value="microneedling">Microneedling</SelectItem>
                      <SelectItem value="hifem">HIFEM body treatment</SelectItem>
                      <SelectItem value="peel">The Perfect Derma Peel</SelectItem>
                      <SelectItem value="ipl">IPL / Laser</SelectItem>
                      <SelectItem value="unsure">Not sure — open to suggestions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FormLabel htmlFor="availability">Availability</FormLabel>
                    <Textarea id="availability" className={textareaClass} placeholder="e.g. Weekday mornings, Saturdays" value={formData.availability} onChange={(e) => updateField("availability", e.target.value)} />
                  </div>

                  <div>
                    <FormLabel htmlFor="reasonForModeling">Why model with us?</FormLabel>
                    <Textarea id="reasonForModeling" className={textareaClass} placeholder="What are you hoping to address?" value={formData.reasonForModeling} onChange={(e) => updateField("reasonForModeling", e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Photos */}
            <section className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 shadow-2xs">
              <SectionHeader icon={Camera} title="4. Reference photos" iconClass="text-[#8B6B5D]" />

              <div className="space-y-3">
                <div className="bg-secondary/40 border border-border rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sun className="h-3.5 w-3.5 text-primary" />
                    <span>Photo tips:</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-tight">
                    Natural daylight facing window • No makeup or filters • Hair pulled back • Neutral expression.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { label: "Front view", desc: "Face camera" },
                    { label: "Left profile", desc: "Turn head right" },
                    { label: "Right profile", desc: "Turn head left" },
                    { label: "Chin up", desc: "Tilt chin up" },
                    { label: "Chin down", desc: "Tuck chin" },
                  ].map((box, i) => (
                    <div key={i} className="relative group border border-dashed border-border rounded-lg bg-card/40 hover:bg-secondary/50 transition-colors p-2.5 flex items-center gap-2 cursor-pointer">
                      <div className="bg-secondary/60 p-2 rounded-md shrink-0">
                        <Camera className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 pr-1">
                        <div className="font-medium text-xs text-foreground truncate">{box.label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{box.desc}</div>
                      </div>
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                    </div>
                  ))}

                  <div className="relative group border border-dashed border-border rounded-lg bg-card/40 hover:bg-secondary/50 transition-colors p-2.5 flex items-center gap-2 cursor-pointer">
                    <div className="bg-secondary/60 p-2 rounded-md shrink-0">
                      <Video className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 pr-1">
                      <div className="font-medium text-xs text-foreground truncate">Video (Optional)</div>
                      <div className="text-[10px] text-muted-foreground truncate">≤ 15s clip</div>
                    </div>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="video/*" />
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Photo Release */}
            <section className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 shadow-2xs">
              <SectionHeader icon={Image} title="5. Photo & video release" iconClass="text-[#8B6B5D]" />

              <div className="flex items-start space-x-2.5">
                <Checkbox id="photo-release-main" required className="mt-0.5 rounded-sm h-4 w-4" checked={formData.photoReleaseMain} onCheckedChange={(checked) => updateField("photoReleaseMain", checked as boolean)} />
                <Label htmlFor="photo-release-main" className="text-xs font-normal leading-relaxed cursor-pointer text-muted-foreground">
                  I understand photos and videos taken before, during, and after treatment may be used by Radiantilyk Aesthetic for marketing purposes (website, social media, advertising). *
                </Label>
              </div>
            </section>

            {/* 6. Consents & Acknowledgments */}
            <section className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 shadow-2xs">
              <SectionHeader icon={CheckCircle2} title="6. Consents & acknowledgments" iconClass="text-[#8B6B5D]" />

              <div className="space-y-2.5">
                {[
                  {
                    key: "release",
                    title: "Model Release — Photo, Video & Marketing",
                    field: "consentModelRelease",
                    label: "I agree to the Model Release agreement. *",
                    text: "I grant Radiantilyk Aesthetic a perpetual, worldwide, royalty-free license to use my likeness (photos, videos, before/after images) for marketing, advertising, educational, and promotional purposes without further compensation.",
                  },
                  {
                    key: "financial",
                    title: "Financial Responsibility & Cancellation Policy",
                    field: "consentFinancial",
                    label: "I agree to the Financial Responsibility & Cancellation terms. *",
                    text: "Model-day services are provided at reduced rates. 48 hours notice is required to reschedule or cancel. A $200 no-show fee applies if failing to appear or cancelling under 48h.",
                  },
                  {
                    key: "risk",
                    title: "Assumption of Risk & Model-Day Terms",
                    field: "consentRiskAndTerms",
                    label: "I agree to the Assumption of Risk terms. *",
                    text: "Aesthetic treatments carry risks including swelling, bruising, and asymmetry. Results vary by individual. Appointments are scheduled around provider training.",
                  },
                  {
                    key: "hipaa",
                    title: "HIPAA Privacy Acknowledgment",
                    field: "consentHipaa",
                    label: "I acknowledge the HIPAA Privacy terms. *",
                    text: "Health information collected on this form is handled in accordance with HIPAA standards and Notice of Privacy Practices.",
                  },
                ].map((item) => {
                  const isOpen = expandedConsent[item.key];
                  return (
                    <div key={item.key} className="border border-border rounded-lg p-3 bg-background/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-foreground">{item.title}</span>
                        <button
                          type="button"
                          onClick={() => toggleConsent(item.key)}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium"
                        >
                          {isOpen ? "Hide terms" : "Read terms"}
                          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                      {isOpen ? (
                        <div className="bg-secondary/40 rounded-md p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                          {item.text}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{item.text}</p>
                      )}
                      <div className="flex items-center space-x-2 pt-0.5">
                        <Checkbox
                          id={`consent-${item.key}`}
                          required
                          className="rounded-sm h-4 w-4"
                          checked={formData[item.field as keyof ModelFormData] as boolean}
                          onCheckedChange={(checked) => updateField(item.field as keyof ModelFormData, checked as boolean)}
                        />
                        <Label htmlFor={`consent-${item.key}`} className="text-xs font-normal cursor-pointer text-muted-foreground">
                          {item.label}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 7. Sign & Submit */}
            <section className="bg-card/50 border border-border rounded-xl p-4 sm:p-5 shadow-2xs">
              <SectionHeader icon={CheckCircle2} title="7. Signature & submit" iconClass="text-[#8B6B5D]" />

              <div className="space-y-3">
                <div>
                  <FormLabel htmlFor="signature">Full legal name *</FormLabel>
                  <Input id="signature" required placeholder="Jane Doe" className={inputClass} value={formData.signatureName} onChange={(e) => updateField("signatureName", e.target.value)} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sign here *</Label>
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border" type="button">Clear</Button>
                  </div>
                  <div className="border border-dashed border-border rounded-md h-24 bg-background/50 relative cursor-crosshair"></div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Sign with your finger, mouse, or stylus.
                  </p>
                </div>
              </div>
            </section>

            {/* Submit CTA */}
            <div className="pt-2 flex flex-col items-center">
              <Button type="submit" disabled={loading} className="w-full sm:max-w-xs h-10 rounded-full text-xs font-medium tracking-wide shadow-sm hover:opacity-90 transition-all bg-[#c6aca0] hover:bg-[#b5998c] text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit application"}
              </Button>
            </div>

          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
