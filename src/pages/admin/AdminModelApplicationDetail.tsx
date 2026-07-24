import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ArrowLeft, Check, X, Mail, Phone, Calendar, Instagram, AlertCircle, FileImage } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const MOCK_DATA = {
  id: "APP-001",
  name: "Jessica Smith",
  email: "jessica.smith@example.com",
  phone: "(555) 123-4567",
  status: "pending",
  date: "2026-07-20",
  procedures: ["Lip Fillers", "Botox", "Cheek Fillers"],
  dob: "1994-05-12",
  instagram: "@jessica_beauty",
  availability: "Weekdays after 3 PM, Weekends",
  previousTreatments: "Botox in forehead (2024), no previous fillers.",
  medicalHistory: "No known allergies. Healthy.",
  goals: "I want a subtle enhancement to my lips and to smooth out my forehead lines. Looking for a natural result.",
  photos: [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80"
  ]
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/40 dark:text-red-200",
};

export default function AdminModelApplicationDetail() {
  const { id } = useParams();
  usePageMeta({ title: `Application ${id || "Details"}` });

  // In a real app, we'd fetch data based on ID. Using MOCK_DATA here.
  const app = MOCK_DATA;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4 border-b border-border pb-5">
        <Button asChild variant="ghost" size="icon" className="rounded-full shrink-0">
          <Link to="/staff/model-applications">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl md:text-3xl">{app.name}</h1>
            <Badge className={STATUS_STYLES[app.status]} variant="outline">
              {app.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {app.id} • Applied on {app.date}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="h-4 w-4 mr-2" /> Approve
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">Applicant Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{app.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{app.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>DOB: {app.dob}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{app.instagram}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">Procedures</CardTitle>
              <CardDescription>Areas of interest</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {app.procedures.map((proc, i) => (
                  <Badge key={i} variant="secondary" className="bg-primary/5 text-primary border-primary/20">
                    {proc}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">Clinical Questionnaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Aesthetic Goals</h4>
                <p className="text-sm bg-muted/30 p-3 rounded-lg border border-border/50">{app.goals}</p>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Previous Treatments</h4>
                <p className="text-sm">{app.previousTreatments}</p>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Medical History Notes</h4>
                <div className="flex gap-2 items-start mt-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm">{app.medicalHistory}</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Availability</h4>
                <p className="text-sm">{app.availability}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <FileImage className="h-5 w-5 text-muted-foreground" />
                Submitted Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {app.photos.map((url, i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl overflow-hidden border border-border/50 shadow-sm relative group bg-muted">
                    <img 
                      src={url} 
                      alt={`Applicant photo ${i + 1}`} 
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                      <Button variant="secondary" size="sm" className="rounded-full opacity-90">View Full</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

