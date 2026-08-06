import { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CheckCircle2, Sparkles, Loader2, Send, Camera, Video, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { apiQuery } from "@/services/api";
import { formatPhone10 } from "@/lib/formatPhone";

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

const INITIAL_FORM_DATA: ModelFormData = {
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
};

export default function Model() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<ModelFormData>(INITIAL_FORM_DATA);

  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const sigContainerRef = useRef<HTMLDivElement | null>(null);
  const [signatureData, setSignatureData] = useState<string>("");
  const [photos, setPhotos] = useState<{ [key: string]: File }>({});
  const [video, setVideo] = useState<File | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = sigCanvasRef.current?.getCanvas();
      const wrap = sigContainerRef.current;
      if (!canvas || !wrap) return;
      const w = wrap.clientWidth || 500;
      canvas.width = w;
      canvas.height = 140;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const clearSignature = () => {
    sigCanvasRef.current?.clear();
    setSignatureData("");
  };

  const updateField = (field: keyof ModelFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (formData.dob) {
      const parts = formData.dob.split("-");
      const yearStr = parts[0] || "";
      const year = parseInt(yearStr, 10);
      const todayStr = new Date().toISOString().split("T")[0];

      if (isNaN(year) || yearStr.length !== 4 || year < 1900 || formData.dob > todayStr) {
        toast.error("Please enter a valid birth date (4-digit year 1900 - today)");
        return;
      }
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);

    const appId = `APP-${Math.floor(100 + Math.random() * 900)}`;
    const appData = {
      id: appId,
      name: formData.name,
      email: formData.email.toLowerCase(),
      phone: formData.phone,
      dob: formData.dob,
      city: formData.city,
      instagram: formData.instagram,
      procedures: formData.treatmentInterest || "General Aesthetics",
      skin_type: formData.skinType,
      pregnancy_status: formData.pregnancyStatus,
      medications: formData.medications,
      allergies: formData.allergies,
      previous_treatments: formData.previousTreatments,
      availability: formData.availability,
      signature_name: formData.signatureName,
      signature_date: formData.signatureDate,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
    };

    // 1. Save to local storage for instant offline availability
    const existing = JSON.parse(localStorage.getItem("rka_demo_model_applications") || "[]");
    existing.unshift(appData);
    localStorage.setItem("rka_demo_model_applications", JSON.stringify(existing));

    // 2. Call backend API endpoint
    try {
      await apiQuery("model_applications" as any).insert(appData);
    } catch (_err) {
      console.warn("Backend model application insert fallback to local storage");
    }

    setFormData(INITIAL_FORM_DATA);
    setLoading(false);
    setSubmitted(true);
    toast.success("Model application submitted successfully! Our team will review and reach out.");
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

        {/* Application Form or Success Card */}
        {submitted ? (
          <div className="bg-card border border-border/80 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">Application Submitted Successfully!</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Thank you for applying to the Radiantilyk Aesthetic Model Program. Our clinical team will review your application details and reach out to you via email or phone.
            </p>
            <div className="pt-4 flex justify-center">
              <Button onClick={() => setSubmitted(false)} variant="outline" className="rounded-full px-6">
                Submit Another Application
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* 1. About You */}
            <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
              <SectionHeader icon={Users} title=" Personal Information" />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <FormLabel htmlFor="name">Full Name *</FormLabel>
                  <Input id="name" required className={inputClass} value={formData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <FormLabel htmlFor="dob">Date of Birth *</FormLabel>
                  <Input
                    id="dob"
                    type="date"
                    required
                    max={new Date().toISOString().split("T")[0]}
                    min="1900-01-01"
                    className={inputClass}
                    value={formData.dob}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val) {
                        const parts = val.split("-");
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].slice(0, 4);
                          val = parts.join("-");
                        }
                      }
                      updateField("dob", val);
                    }}
                  />
                </div>
                <div>
                  <FormLabel htmlFor="email">Email Address *</FormLabel>
                  <Input id="email" type="email" required className={inputClass} value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="jane@example.com" />
                </div>
                <div>
                  <FormLabel htmlFor="phone">Phone Number *</FormLabel>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    maxLength={14}
                    className={inputClass}
                    value={formData.phone}
                    onChange={(e) => updateField("phone", formatPhone10(e.target.value))}
                    placeholder="(408) 555-0123"
                  />
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
              <SectionHeader icon={CheckCircle2} title="Health & Medical Screening" />

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
            <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <SectionHeader icon={Sparkles} title="What model day are you interested in?" />

              <div className="space-y-4">
                <div>
                  <FormLabel htmlFor="treatment-interest">REQUESTED SERVICE *</FormLabel>
                  <Select
                    value={formData.treatmentInterest}
                    onValueChange={(val) => updateField("treatmentInterest", val)}
                  >
                    <SelectTrigger id="treatment-interest" className="h-11 rounded-xl bg-card border-border/80 text-xs sm:text-sm">
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Neurotoxin (Botox / Dysport / Xeomin)">Neurotoxin (Botox / Dysport / Xeomin)</SelectItem>
                      <SelectItem value="Filler">Filler</SelectItem>
                      <SelectItem value="Sculptra / Bio-stimulator">Sculptra / Bio-stimulator</SelectItem>
                      <SelectItem value="Microneedling">Microneedling</SelectItem>
                      <SelectItem value="HIFEM body treatment">HIFEM body treatment</SelectItem>
                      <SelectItem value="The Perfect Derma Peel">The Perfect Derma Peel</SelectItem>
                      <SelectItem value="IPL / Laser">IPL / Laser</SelectItem>
                      <SelectItem value="Not sure — open to suggestions">Not sure — open to suggestions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <FormLabel htmlFor="availability">AVAILABILITY (DAYS/TIMES THAT WORK BEST)</FormLabel>
                  <Textarea
                    id="availability"
                    className={textareaClass}
                    placeholder="e.g. Weekday mornings, most Saturdays"
                    value={formData.availability}
                    onChange={(e) => updateField("availability", e.target.value)}
                  />
                </div>

                <div>
                  <FormLabel htmlFor="reason">WHY DO YOU WANT TO BE A MODEL WITH US?</FormLabel>
                  <Textarea
                    id="reason"
                    className={textareaClass}
                    placeholder="Tell us a little about you and what you're hoping to address."
                    value={formData.reasonForModeling}
                    onChange={(e) => updateField("reasonForModeling", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 4. Photos */}
            <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
              <SectionHeader icon={Camera} title="Photos" />

              {/* How to take good reference photos */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-xs sm:text-sm">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>How to take good reference photos</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Use natural daylight — stand facing a window, no overhead lights.</li>
                  <li>No makeup, filters, or editing.</li>
                  <li>Hair pulled back from your face.</li>
                  <li>Neutral expression, mouth relaxed.</li>
                  <li>Plain background, phone held at eye level.</li>
                </ul>
              </div>

              {/* 5 Photo Upload Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: "front", title: "Front view", desc: "Face the camera, neutral expression" },
                  { id: "left", title: "Left side (profile)", desc: "Turn head fully to your right so we see left profile" },
                  { id: "right", title: "Right side (profile)", desc: "Turn head fully to your left so we see right profile" },
                  { id: "chinUp", title: "Chin up", desc: "Tilt chin up toward the ceiling, mouth relaxed" },
                  { id: "chinDown", title: "Chin down", desc: "Tuck chin toward chest, look at the camera" },
                ].map((slot) => (
                  <label
                    key={slot.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border border-dashed transition cursor-pointer ${photos[slot.id] ? "border-primary bg-primary/5" : "border-border/80 bg-background/50 hover:border-primary/50"
                      }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPhotos((prev) => ({ ...prev, [slot.id]: file }));
                      }}
                    />
                    <div className="p-2.5 rounded-lg bg-card border border-border/60 shrink-0 text-muted-foreground">
                      <Camera className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>{slot.title}</span>
                        {photos[slot.id] && <span className="text-[10px] text-primary font-normal">Uploaded</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{slot.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Optional Short Video */}
              <div className="space-y-2 pt-1">
                <FormLabel>OPTIONAL SHORT VIDEO (≤ 15 SECONDS, NO MAKEUP)</FormLabel>
                <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-dashed border-border/80 bg-background/50 hover:border-primary/50 cursor-pointer transition">
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setVideo(file);
                    }}
                  />
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {video ? video.name : "Tap to attach a short clip showing dynamic movement (smile, frown, raise brows)"}
                    </span>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-3 rounded-lg border-border/80 shrink-0 pointer-events-none">
                    {video ? "Change" : "Add video"}
                  </Button>
                </label>
              </div>

              {/* Photo & Video use consent */}
              <div className="pt-3 border-t border-border/60 space-y-3">
                <div className="flex items-center gap-2 font-serif text-sm font-semibold text-foreground">
                  <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                  <span>Photo & video use</span>
                </div>
                <div className="flex items-start space-x-2.5 p-3 rounded-xl border border-border/60 bg-background/40">
                  <Checkbox
                    id="photo-video-consent"
                    required
                    className="mt-0.5 rounded h-4 w-4"
                    checked={photoConsent}
                    onCheckedChange={(checked) => setPhotoConsent(checked as boolean)}
                  />
                  <Label htmlFor="photo-video-consent" className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer">
                    I understand that photos and videos will be taken before, during, and after my model-day treatment, and that Radiantilyk Aesthetic may use them for marketing purposes (website, social media, print, and paid advertising). *
                  </Label>
                </div>
              </div>
            </section>

            {/* 5. Consents & Acknowledgments */}
            <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <SectionHeader icon={CheckCircle2} title="Consents & acknowledgments" />

              <div className="space-y-4">
                {/* Card 1: Model Release */}
                <div className="border border-border/70 rounded-xl p-4 sm:p-5 bg-background/40 space-y-2.5">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground">Model Release — Photo, Video & Marketing</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    I grant Radiantilyk Aesthetic and its licensees a perpetual, worldwide, royalty-free, irrevocable right and license to use, reproduce, distribute, publicly display, and create derivative works of my likeness (photos, videos, before/after images, and voice) in any and all media now known or later developed, for marketing, advertising, educational, and promotional purposes, without further compensation. I waive any right to inspect or approve the finished materials. I release Radiantilyk Aesthetic from any claims arising from use of the materials.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox id="consent-model-release" required className="h-4 w-4 rounded" checked={formData.consentModelRelease} onCheckedChange={(checked) => updateField("consentModelRelease", checked as boolean)} />
                    <Label htmlFor="consent-model-release" className="text-xs text-muted-foreground cursor-pointer font-normal">
                      I have read and agree to the Model Release — Photo, Video & Marketing above. *
                    </Label>
                  </div>
                </div>

                {/* Card 2: Financial Responsibility */}
                <div className="border border-border/70 rounded-xl p-4 sm:p-5 bg-background/40 space-y-2.5">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground">Financial Responsibility</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    I understand that model-day services are provided at a reduced or complimentary rate in exchange for my participation and photo/video release. I agree to Radiantilyk Aesthetic's cancellation policy: 48 hours' notice is required to reschedule or cancel. A $200 no-show fee will be charged to my card on file if I fail to appear or cancel with less than 48 hours' notice. I am financially responsible for any additional products, units, or services beyond the model-day scope.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox id="consent-financial" required className="h-4 w-4 rounded" checked={formData.consentFinancial} onCheckedChange={(checked) => updateField("consentFinancial", checked as boolean)} />
                    <Label htmlFor="consent-financial" className="text-xs text-muted-foreground cursor-pointer font-normal">
                      I have read and agree to the Financial Responsibility above. *
                    </Label>
                  </div>
                </div>

                {/* Card 3: Assumption of Risk & Model-Day Terms */}
                <div className="border border-border/70 rounded-xl p-4 sm:p-5 bg-background/40 space-y-2.5">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground">Assumption of Risk & Model-Day Terms</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    I understand that aesthetic treatments carry risks including but not limited to bruising, swelling, redness, asymmetry, infection, and less common serious complications. Results are not guaranteed and vary by individual. I understand that model-day appointments are scheduled around provider training or content needs and that specific outcomes are not promised. I agree to follow all pre- and post-care instructions.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox id="consent-risk" required className="h-4 w-4 rounded" checked={formData.consentRiskAndTerms} onCheckedChange={(checked) => updateField("consentRiskAndTerms", checked as boolean)} />
                    <Label htmlFor="consent-risk" className="text-xs text-muted-foreground cursor-pointer font-normal">
                      I have read and agree to the Assumption of Risk & Model-Day Terms above. *
                    </Label>
                  </div>
                </div>

                {/* Card 4: HIPAA Acknowledgment */}
                <div className="border border-border/70 rounded-xl p-4 sm:p-5 bg-background/40 space-y-2.5">
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground">HIPAA Acknowledgment</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    I acknowledge that Radiantilyk Aesthetic has a Notice of Privacy Practices describing how my protected health information may be used and disclosed, and that I may request a copy at any time. Health information collected on this form will be handled in accordance with HIPAA.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox id="consent-hipaa" required className="h-4 w-4 rounded" checked={formData.consentHipaa} onCheckedChange={(checked) => updateField("consentHipaa", checked as boolean)} />
                    <Label htmlFor="consent-hipaa" className="text-xs text-muted-foreground cursor-pointer font-normal">
                      I have read and agree to the HIPAA Acknowledgment above. *
                    </Label>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Sign to Submit */}
            <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <SectionHeader icon={CheckCircle2} title="Sign to submit" />

              <div className="space-y-4">
                <div>
                  <FormLabel htmlFor="sig-name">TYPE YOUR FULL LEGAL NAME *</FormLabel>
                  <Input
                    id="sig-name"
                    required
                    className={inputClass}
                    placeholder="First Last, credentials (e.g. Jane Doe, NP)"
                    value={formData.signatureName}
                    onChange={(e) => updateField("signatureName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>SIGN HERE *</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSignature}
                      className="h-7 text-xs px-3 rounded-md border-border/80"
                    >
                      Clear
                    </Button>
                  </div>

                  <div ref={sigContainerRef} className="border-2 border-dashed border-border/80 rounded-2xl bg-background/50 overflow-hidden relative p-1 min-h-[140px] flex items-center justify-center">
                    <SignatureCanvas
                      ref={sigCanvasRef}
                      penColor="#0f172a"
                      canvasProps={{
                        className: "w-full h-36 rounded-xl cursor-crosshair touch-none",
                      }}
                      onEnd={() => {
                        if (sigCanvasRef.current) {
                          setSignatureData(sigCanvasRef.current.getCanvas().toDataURL("image/png"));
                        }
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Sign with your finger or Apple Pencil. Tap Clear to redo.
                  </p>
                </div>
              </div>
            </section>

            {/* Submit Button */}
            <div className="flex flex-col items-center space-y-2 pt-2">
              <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto rounded-full px-12 font-semibold shadow-md min-w-[240px]">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    Submit application
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
