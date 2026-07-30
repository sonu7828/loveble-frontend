import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen, Calendar, Users, ShieldAlert, Laptop, Building2,
  FileCheck, Stethoscope, HelpCircle, CheckCircle2, ChevronRight
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function StaffHelp() {
  usePageMeta({ title: "Staff Handbook & Guide" });

  useEffect(() => {
    try { localStorage.setItem("rka_handbook_read", "1"); } catch {}
  }, []);

  const WORKFLOW_CARDS = [
    {
      icon: Calendar,
      title: "1. Appointments & Calendar",
      desc: "View your daily schedule, manage client bookings, update appointment statuses, and sync personal Google Calendar.",
      link: "/staff/today",
      linkText: "View Today's Schedule",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
    },
    {
      icon: Users,
      title: "2. Client Profiles & Charting",
      desc: "Access client medical records, complete Good Faith Examinations (GFEs), upload photos, and manage consent signatures.",
      link: "/staff/team",
      linkText: "View Practice Team",
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
    },
    {
      icon: ShieldAlert,
      title: "3. HIPAA & Security Incidents",
      desc: "Report security incidents or lost devices immediately. Automatically logged for Privacy Officer review under 15-day CMIA rules.",
      link: "/staff/breach-report",
      linkText: "File Breach Report",
      color: "text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
    },
    {
      icon: Building2,
      title: "4. Vendor & BAA Management",
      desc: "Track software vendors (Supabase, Twilio/GHL, Resend, Stripe) and ensure signed Business Associate Agreements are on file.",
      link: "/staff/vendors",
      linkText: "Manage Vendors",
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
    },
    {
      icon: Laptop,
      title: "5. IT Hardware & Device Inventory",
      desc: "Log workstations, iPads, and mobile devices used in the clinic to ensure full-disk encryption and screen-lock compliance.",
      link: "/staff/vendors?tab=devices",
      linkText: "View IT Devices",
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
    },
    {
      icon: Stethoscope,
      title: "6. Digital Signature & Profile",
      desc: "Set up your provider title, license number, and draw your saved digital signature for auto-signing chart notes and GFEs.",
      link: "/staff/me",
      linkText: "Edit My Profile",
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
    },
  ];

  const FAQS = [
    {
      q: "How do I sign chart notes and GFEs?",
      a: "Go to My Profile (/staff/me) -> Draw your signature on the pad and click 'Save signature'. Your signature will auto-fill whenever you sign a chart note or GFE.",
    },
    {
      q: "What should I do if a device is lost or a privacy breach happens?",
      a: "Go to Breach Reports (/staff/breach-report) -> Fill the description field and submit. The Privacy & Security Officer will be notified immediately to handle investigation.",
    },
    {
      q: "How does the 15-minute auto-logout work?",
      a: "For HIPAA compliance, if your screen is left idle for 15 minutes without activity, the system automatically signs out to protect patient data.",
    },
    {
      q: "Where do I find active services and pricing?",
      a: "Go to Services & Pricing in the sidebar menu to review all active treatment categories, appointment durations, and pricing.",
    },
  ];

  return (
    <div className="w-[90%] max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase mb-2">
          <BookOpen className="h-4 w-4" /> Staff Handbook &amp; System Guide
        </div>
        <h1 className="font-serif text-3xl md:text-4xl mb-2">Welcome to Radiantilyk Aesthetic</h1>
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          Your day-to-day practice guide and software manual. Learn how to manage client appointments, report security incidents, manage IT devices, and update your provider profile.
        </p>

        {/* Practice Meta Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 p-4 rounded-xl border border-border bg-card">
          <div>
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Practice Name</div>
            <div className="text-sm font-medium text-foreground">Radiantilyk Aesthetic</div>
            <div className="text-xs text-muted-foreground">San Jose, CA</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Lead Injector &amp; Founder</div>
            <div className="text-sm font-medium text-foreground">Kiem Vukadinovic, NP</div>
            <div className="text-xs text-muted-foreground">Privacy &amp; Security Officer</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Medical Director</div>
            <div className="text-sm font-medium text-foreground">Dr. Aloysius N. Fobi, MD</div>
            <div className="text-xs text-muted-foreground">Clinical Oversight</div>
          </div>
        </div>
      </div>

      {/* System Workflows Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl">Staff Workflows &amp; Modules</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Click any module below to quickly navigate to its practice workflow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {WORKFLOW_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="flex flex-col justify-between hover:shadow-md transition">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2.5 rounded-xl border ${card.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base font-semibold">{card.title}</CardTitle>
                  </div>
                  <CardDescription className="text-xs leading-relaxed mt-1">
                    {card.desc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <Button asChild variant="ghost" size="sm" className="w-full justify-between rounded-lg hover:bg-primary/5 text-xs text-primary font-medium p-0 h-8">
                    <Link to={card.link}>
                      <span>{card.linkText}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-2xl">Frequently Asked Questions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQS.map((faq, i) => (
            <div key={i} className="p-5 rounded-2xl border border-border bg-card space-y-2">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {faq.q}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="pt-6 border-t border-border text-center text-xs text-muted-foreground">
        Radiantilyk Aesthetic · Staff Handbook &amp; System Guide · Last updated July 2026
      </div>
    </div>
  );
}
