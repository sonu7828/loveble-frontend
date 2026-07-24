import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Users, Activity, CheckCircle2, Sparkles, Camera, CheckSquare, PenTool, Loader2, UploadCloud, Info, Sun, Video, Image } from "lucide-react";
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
      toast.success("Application submitted successfully! We will be in touch soon.");
    }, 1500);
  };

  const SectionHeader = ({ icon: Icon, title, iconClass = "text-primary" }: { icon: any, title: string, iconClass?: string }) => (
    <div className="flex items-center gap-2.5 border-b border-border/60 pb-3 mb-6">
      <Icon className={`h-5 w-5 ${iconClass}`} strokeWidth={1.5} />
      <h2 className="font-serif text-xl md:text-2xl tracking-wide text-foreground">{title}</h2>
    </div>
  );

  const FormLabel = ({ htmlFor, children }: { htmlFor?: string, children: React.ReactNode }) => (
    <Label htmlFor={htmlFor} className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 block">
      {children}
    </Label>
  );

  const inputClass = "h-11 rounded-md bg-transparent border-border/80 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary";
  const textareaClass = "min-h-[80px] rounded-md bg-transparent border-border/80 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary resize-y py-3";

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <SiteHeader />

      <main className="flex-1 pt-8 md:pt-12 pb-16 md:pb-24">
        <div className="container max-w-2xl px-4 md:px-6 mx-auto">

          {/* Header Section */}
          <div className="text-center mb-12 space-y-4">
            <Badge variant="outline" className="uppercase tracking-[0.2em] text-[10px] font-medium border-primary/20 bg-primary/5 text-primary px-3 py-1 rounded-full">
              <Sparkles className="w-3 h-3 mr-1.5 inline" /> Model Program
            </Badge>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground tracking-tight font-light">Become a model</h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-[500px] mx-auto leading-relaxed">
              Receive complimentary or significantly reduced treatments in exchange for photos and videos we can use in our marketing. All treatments are performed by our trained medical team in our clinic.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-12">

            {/* 1. About you */}
            <section>
              <SectionHeader icon={Users} title="About you" iconClass="text-[#8B6B5D]" />

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-1">
                    <FormLabel htmlFor="name">Full name *</FormLabel>
                    <Input id="name" required className={inputClass} value={formData.name} onChange={(e) => updateField("name", e.target.value)} />
                  </div>
                  <div className="hidden sm:block"></div>

                  <div>
                    <FormLabel htmlFor="email">Email *</FormLabel>
                    <Input id="email" type="email" required className={inputClass} value={formData.email} onChange={(e) => updateField("email", e.target.value)} />
                  </div>
                  <div>
                    <FormLabel htmlFor="phone">Phone *</FormLabel>
                    <Input id="phone" type="tel" required className={inputClass} value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} />
                  </div>

                  <div>
                    <FormLabel htmlFor="dob">Date of birth *</FormLabel>
                    <Input id="dob" type="date" required className={inputClass} value={formData.dob} onChange={(e) => updateField("dob", e.target.value)} />
                  </div>
                  <div>
                    <FormLabel htmlFor="city">City / neighborhood</FormLabel>
                    <Input id="city" className={inputClass} placeholder="San Jose, CA" value={formData.city} onChange={(e) => updateField("city", e.target.value)} />
                  </div>

                  <div>
                    <FormLabel htmlFor="instagram">Instagram handle</FormLabel>
                    <Input id="instagram" className={inputClass} placeholder="@yourhandle" value={formData.instagram} onChange={(e) => updateField("instagram", e.target.value)} />
                  </div>
                  <div>
                    <FormLabel htmlFor="heard-from">How did you hear about us?</FormLabel>
                    <Input id="heard-from" className={inputClass} placeholder="Instagram, friend, Google..." value={formData.howDidYouHear} onChange={(e) => updateField("howDidYouHear", e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <Checkbox id="age-confirm" required className="rounded-[4px] h-5 w-5 bg-transparent" checked={formData.ageConfirm} onCheckedChange={(checked) => updateField("ageConfirm", checked as boolean)} />
                  <Label htmlFor="age-confirm" className="text-[14px] font-normal cursor-pointer text-muted-foreground">
                    I confirm I am 18 years of age or older. *
                  </Label>
                </div>
              </div>
            </section>

            {/* 2. Health screening */}
            <section>
              <SectionHeader icon={CheckCircle2} title="Health screening" iconClass="text-[#8B6B5D]" />

              <div className="space-y-5">
                <div>
                  <FormLabel>Fitzpatrick Skin Type (If Known)</FormLabel>
                  <Select value={formData.skinType} onValueChange={(value) => updateField("skinType", value)}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Select your skin type" />
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
                  <FormLabel>Are you currently pregnant or breastfeeding? *</FormLabel>
                  <RadioGroup value={formData.pregnancyStatus} onValueChange={(value) => updateField("pregnancyStatus", value)} className="flex flex-row gap-6 mt-2">
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="no" id="preg-no" className="h-4 w-4" />
                      <Label htmlFor="preg-no" className="text-sm font-normal cursor-pointer">No</Label>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="yes" id="preg-yes" className="h-4 w-4" />
                      <Label htmlFor="preg-yes" className="text-sm font-normal cursor-pointer">Yes</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <FormLabel htmlFor="medications">Current medications</FormLabel>
                  <Textarea id="medications" className={textareaClass} placeholder='List prescription and OTC medications, or write "None"' value={formData.medications} onChange={(e) => updateField("medications", e.target.value)} />
                </div>

                <div>
                  <FormLabel htmlFor="allergies">Known allergies</FormLabel>
                  <Textarea id="allergies" className={textareaClass} placeholder='Latex, lidocaine, foods, or "None"' value={formData.allergies} onChange={(e) => updateField("allergies", e.target.value)} />
                </div>

                <div>
                  <FormLabel htmlFor="treatments">Aesthetic treatments in the last 6 months</FormLabel>
                  <Textarea id="treatments" className={textareaClass} placeholder="e.g. Botox 3 months ago, Juvederm 6 months ago" value={formData.previousTreatments} onChange={(e) => updateField("previousTreatments", e.target.value)} />
                </div>
              </div>
            </section>

            {/* 3. What model day are you interested in? */}
            <section>
              <SectionHeader icon={Sparkles} title="What model day are you interested in?" iconClass="text-[#8B6B5D]" />

              <div className="space-y-5">
                <div>
                  <FormLabel>Requested Service *</FormLabel>
                  <Select required value={formData.treatmentInterest} onValueChange={(value) => updateField("treatmentInterest", value)}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Choose one" />
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

                <div>
                  <FormLabel htmlFor="availability">Availability (Days/Times that work best)</FormLabel>
                  <Textarea id="availability" className={textareaClass} placeholder="e.g. Weekday mornings, most Saturdays" value={formData.availability} onChange={(e) => updateField("availability", e.target.value)} />
                </div>

                <div>
                  <FormLabel htmlFor="reasonForModeling">Why do you want to be a model with us?</FormLabel>
                  <Textarea id="reasonForModeling" className={textareaClass} placeholder="Tell us a little about you and what you're hoping to address." value={formData.reasonForModeling} onChange={(e) => updateField("reasonForModeling", e.target.value)} />
                </div>
              </div>
            </section>

            {/* 4. Photos */}
            <section>
              <SectionHeader icon={Camera} title="Photos" iconClass="text-[#8B6B5D]" />

              <div className="space-y-5">
                <div className="bg-[#fcfbf9] border border-border/50 rounded-xl p-5 text-sm space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Sun className="h-4 w-4 text-[#8B6B5D]" />
                    <span>How to take good reference photos</span>
                  </div>
                  <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground marker:text-muted-foreground text-[13px]">
                    <li>Use natural daylight — stand facing a window, no overhead lights.</li>
                    <li>No makeup, filters, or editing.</li>
                    <li>Hair pulled back from your face.</li>
                    <li>Neutral expression, mouth relaxed.</li>
                    <li>Plain background, phone held at eye level.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Front view", desc: "Face the camera, neutral expressio..." },
                    { label: "Left side (profile)", desc: "Turn head fully to your right so we ..." },
                    { label: "Right side (profile)", desc: "Turn head fully to your left so we se..." },
                    { label: "Chin up", desc: "Tilt chin up toward the ceiling, mout..." },
                    { label: "Chin down", desc: "Tuck chin toward chest, look at the ..." },
                  ].map((box, i) => (
                    <div key={i} className="relative group overflow-hidden border border-dashed border-border/80 rounded-xl bg-card/20 hover:bg-accent/20 transition-colors flex items-center p-3 gap-4 cursor-pointer">
                      <div className="bg-[#f7f6f4] p-4 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <Camera className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0 pr-2">
                        <div className="font-medium text-[13px] text-foreground truncate">{box.label}</div>
                        <div className="text-[12px] text-muted-foreground truncate">{box.desc}</div>
                      </div>
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <FormLabel>Optional short video (≤ 15 seconds, no makeup)</FormLabel>
                  <div className="border border-dashed border-border/80 rounded-xl p-4 bg-card/20 flex flex-col sm:flex-row gap-4 items-center justify-between mt-2 cursor-pointer relative hover:bg-accent/20 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <Video className="h-5 w-5 text-muted-foreground/60 flex-shrink-0" strokeWidth={1.5} />
                      <div className="text-[13px] text-muted-foreground leading-snug">
                        Tap to attach a short clip showing dynamic movement (smile, frown, raise brows)
                      </div>
                    </div>
                    <Button variant="secondary" className="shrink-0 h-8 text-[11px] font-medium rounded-full px-4 bg-[#f0edea] hover:bg-[#e6e3df] text-muted-foreground pointer-events-none" type="button">
                      Add video
                    </Button>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="video/*" />
                  </div>
                </div>
              </div>
            </section>
            {/* 5. Photo & video use */}
            <section>
              <SectionHeader icon={Image} title="Photo & video use" iconClass="text-[#8B6B5D]" />

              <div className="flex items-start space-x-3 pt-2">
                <Checkbox id="photo-release-main" required className="mt-0.5 rounded-[4px] h-5 w-5 bg-transparent" checked={formData.photoReleaseMain} onCheckedChange={(checked) => updateField("photoReleaseMain", checked as boolean)} />
                <Label htmlFor="photo-release-main" className="text-[14px] font-normal leading-relaxed cursor-pointer text-muted-foreground">
                  I understand that photos and videos will be taken before, during, and after my model-day treatment, and that Radiantilyk Aesthetic may use them for marketing purposes (website, social media, print, and paid advertising). *
                </Label>
              </div>
            </section>

            {/* 6. Consents & acknowledgments */}
            <section>
              <SectionHeader icon={CheckCircle2} title="Consents & acknowledgments" iconClass="text-[#8B6B5D]" />

              <div className="space-y-6">

                {/* Terms Box 1 */}
                <div className="border border-border/60 rounded-xl p-5 bg-card/20 space-y-4">
                  <h3 className="font-semibold text-foreground text-[16px]">Model Release — Photo, Video & Marketing</h3>
                  <div className="bg-[#f7f6f4] rounded-lg p-4 text-[13.5px] text-muted-foreground leading-relaxed">
                    I grant Radiantilyk Aesthetic and its licensees a perpetual, worldwide, royalty-free, irrevocable right and license to use, reproduce, distribute, publicly display, and create derivative works of my likeness (photos, videos, before/after images, and voice) in any and all media now known or later developed, for marketing, advertising, educational, and promotional purposes, without further compensation. I waive any right to inspect or approve the finished materials. I release Radiantilyk Aesthetic from any claims arising from use of the materials.
                  </div>
                  <div className="flex items-center space-x-3 pt-1">
                    <Checkbox id="consent-model-release" required className="rounded-[4px] h-5 w-5 bg-transparent" checked={formData.consentModelRelease} onCheckedChange={(checked) => updateField("consentModelRelease", checked as boolean)} />
                    <Label htmlFor="consent-model-release" className="text-[14px] font-normal cursor-pointer text-muted-foreground">
                      I have read and agree to the Model Release — Photo, Video & Marketing above. *
                    </Label>
                  </div>
                </div>

                {/* Terms Box 2 */}
                <div className="border border-border/60 rounded-xl p-5 bg-card/20 space-y-4">
                  <h3 className="font-semibold text-foreground text-[16px]">Financial Responsibility</h3>
                  <div className="bg-[#f7f6f4] rounded-lg p-4 text-[13.5px] text-muted-foreground leading-relaxed">
                    I understand that model-day services are provided at a reduced or complimentary rate in exchange for my participation and photo/video release. I agree to Radiantilyk Aesthetic's cancellation policy: 48 hours' notice is required to reschedule or cancel. A $200 no-show fee will be charged to my card on file if I fail to appear or cancel with less than 48 hours' notice. I am financially responsible for any additional products, units, or services beyond the model-day scope.
                  </div>
                  <div className="flex items-center space-x-3 pt-1">
                    <Checkbox id="consent-financial" required className="rounded-[4px] h-5 w-5 bg-transparent" checked={formData.consentFinancial} onCheckedChange={(checked) => updateField("consentFinancial", checked as boolean)} />
                    <Label htmlFor="consent-financial" className="text-[14px] font-normal cursor-pointer text-muted-foreground">
                      I have read and agree to the Financial Responsibility above. *
                    </Label>
                  </div>
                </div>

                {/* Terms Box 3 */}
                <div className="border border-border/60 rounded-xl p-5 bg-card/20 space-y-4">
                  <h3 className="font-semibold text-foreground text-[16px]">Assumption of Risk & Model-Day Terms</h3>
                  <div className="bg-[#f7f6f4] rounded-lg p-4 text-[13.5px] text-muted-foreground leading-relaxed">
                    I understand that aesthetic treatments carry risks including but not limited to bruising, swelling, redness, asymmetry, infection, and less common serious complications. Results are not guaranteed and vary by individual. I understand that model-day appointments are scheduled around provider training or content needs and that specific outcomes are not promised. I agree to follow all pre- and post-care instructions.
                  </div>
                  <div className="flex items-center space-x-3 pt-1">
                    <Checkbox id="consent-risk" required className="rounded-[4px] h-5 w-5 bg-transparent" checked={formData.consentRiskAndTerms} onCheckedChange={(checked) => updateField("consentRiskAndTerms", checked as boolean)} />
                    <Label htmlFor="consent-risk" className="text-[14px] font-normal cursor-pointer text-muted-foreground">
                      I have read and agree to the Assumption of Risk & Model-Day Terms above. *
                    </Label>
                  </div>
                </div>

                {/* Terms Box 4 */}
                <div className="border border-border/60 rounded-xl p-5 bg-card/20 space-y-4">
                  <h3 className="font-semibold text-foreground text-[16px]">HIPAA Acknowledgment</h3>
                  <div className="bg-[#f7f6f4] rounded-lg p-4 text-[13.5px] text-muted-foreground leading-relaxed">
                    I acknowledge that Radiantilyk Aesthetic has a Notice of Privacy Practices describing how my protected health information may be used and disclosed, and that I may request a copy at any time. Health information collected on this form will be handled in accordance with HIPAA.
                  </div>
                  <div className="flex items-center space-x-3 pt-1">
                    <Checkbox id="consent-hipaa" required className="rounded-[4px] h-5 w-5 bg-transparent" checked={formData.consentHipaa} onCheckedChange={(checked) => updateField("consentHipaa", checked as boolean)} />
                    <Label htmlFor="consent-hipaa" className="text-[14px] font-normal cursor-pointer text-muted-foreground">
                      I have read and agree to the HIPAA Acknowledgment above. *
                    </Label>
                  </div>
                </div>

              </div>
            </section>

            {/* 7. Sign to submit */}
            <section>
              <SectionHeader icon={CheckCircle2} title="Sign to submit" iconClass="text-[#8B6B5D]" />

              <div className="border border-border/60 p-5 rounded-xl space-y-5 bg-card/20">
                <div>
                  <FormLabel htmlFor="signature">Type your full legal name *</FormLabel>
                  <Input id="signature" required placeholder="First Last, credentials (e.g. Jane Doe, NP)" className="h-11 bg-transparent border-border/60 rounded-md text-[14px]" value={formData.signatureName} onChange={(e) => updateField("signatureName", e.target.value)} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Sign here *</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-[12px] px-2 font-medium bg-[#f9f8f6] hover:bg-[#f0edea] text-foreground border border-border/50" type="button">Clear</Button>
                  </div>
                  <div className="border border-dashed border-border/80 rounded-md h-40 bg-transparent relative cursor-crosshair"></div>
                  <div className="text-[11px] text-muted-foreground mt-2">
                    Sign with your finger or Apple Pencil. Tap Clear to redo.
                  </div>
                </div>
              </div>
            </section>

            {/* Submit */}
            <div className="pt-10 flex flex-col items-center pb-8">
              <Button type="submit" disabled={loading} className="w-full sm:max-w-md h-[48px] rounded-full text-[15px] font-normal tracking-wide shadow-none hover:opacity-90 transition-all bg-[#c6aca0] hover:bg-[#b5998c] text-white">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit application"}
              </Button>
              <div className="text-[13px] text-muted-foreground mt-3 text-center">
                Still needed: Front view, Left side (profile), Right side (profile), Chin up, Chin down
              </div>
            </div>

          </form>
        </div>
      </main>

      <div className="mt-8">
        <SiteFooter />
      </div>
    </div>
  );
}
