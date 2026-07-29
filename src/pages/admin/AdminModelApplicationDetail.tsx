import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ArrowLeft, Check, X, Mail, Phone, Calendar, Instagram, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiQuery } from "@/services/api";
import { toast } from "sonner";

const DEFAULT_MOCK = {
  id: "APP-001",
  name: "Sample Applicant",
  email: "applicant@example.com",
  phone: "(555) 123-4567",
  status: "pending",
  date: "2026-07-29",
  procedures: "Lip Fillers, Botox",
  dob: "1995-05-12",
  instagram: "@beauty_model",
  availability: "Weekdays after 3 PM",
  previousTreatments: "Botox in forehead (2024)",
  medications: "None",
  allergies: "None",
  goals: "Interested in subtle lip volume enhancement.",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/40 dark:text-red-200",
};

export default function AdminModelApplicationDetail() {
  const { id } = useParams();
  usePageMeta({ title: `Application ${id || "Details"}` });

  const [app, setApp] = useState<any>(null);

  useEffect(() => {
    const localApps = JSON.parse(localStorage.getItem("rka_demo_model_applications") || "[]");
    const found = localApps.find((a: any) => a.id === id);
    if (found) {
      setApp(found);
    } else {
      apiQuery("model_applications" as any).select("*").eq("id", id).then(({ data }) => {
        if (data && data[0]) {
          setApp(data[0]);
        } else {
          setApp({ ...DEFAULT_MOCK, id: id || "APP-001" });
        }
      }).catch(() => {
        setApp({ ...DEFAULT_MOCK, id: id || "APP-001" });
      });
    }
  }, [id]);

  const handleUpdateStatus = async (newStatus: "approved" | "rejected") => {
    if (!app) return;
    const updated = { ...app, status: newStatus };
    setApp(updated);

    // Update local storage
    const localApps = JSON.parse(localStorage.getItem("rka_demo_model_applications") || "[]");
    const updatedLocal = localApps.map((a: any) => a.id === app.id ? { ...a, status: newStatus } : a);
    localStorage.setItem("rka_demo_model_applications", JSON.stringify(updatedLocal));

    // Update remote API
    try {
      await apiQuery("model_applications" as any).update({ id: app.id, status: newStatus });
    } catch (_err) {}

    toast.success(`Application marked as ${newStatus}`);
  };

  if (!app) return null;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full shrink-0">
            <Link to="/staff/model-applications">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl md:text-3xl">{app.name}</h1>
              <Badge className={STATUS_STYLES[app.status || "pending"]} variant="outline">
                {(app.status || "pending").toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {app.id} • Applied on {app.date || new Date(app.created_at || Date.now()).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {app.status !== "rejected" && (
            <Button
              variant="outline"
              onClick={() => handleUpdateStatus("rejected")}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-4 w-4 mr-2" /> Reject
            </Button>
          )}
          {app.status !== "approved" && (
            <Button
              onClick={() => handleUpdateStatus("approved")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" /> Approve
            </Button>
          )}
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
                <span>DOB: {app.dob || "N/A"}</span>
              </div>
              {app.instagram && (
                <div className="flex items-center gap-3 text-sm">
                  <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{app.instagram}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">Procedures of Interest</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 text-xs px-2.5 py-1">
                {app.procedures || "General Aesthetics"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">Clinical Questionnaire & Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Previous Treatments</h4>
                <p className="text-sm bg-muted/30 p-3 rounded-lg border border-border/50">{app.previous_treatments || app.previousTreatments || "None reported"}</p>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Medications & Allergies</h4>
                <div className="flex gap-2 items-start mt-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm">Medications: {app.medications || "None"} • Allergies: {app.allergies || "None"}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Availability</h4>
                <p className="text-sm">{app.availability || "Flexible"}</p>
              </div>

              {app.signature_name && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Digital Signature</h4>
                    <p className="text-sm font-serif italic">{app.signature_name} (Signed on {app.signature_date})</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
