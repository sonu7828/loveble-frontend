import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen, Calendar, Users, ShieldAlert, Laptop, Building2,
  FileCheck, Stethoscope, HelpCircle, Pill, BarChart3, ChevronRight, UserCheck, CheckCircle2
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";

export default function StaffHelp() {
  usePageMeta({ title: "Staff Handbook & Guide" });
  const { isMedicalDirector, isPrivacyOfficer, isAdmin } = useAuth();

  useEffect(() => {
    try { localStorage.setItem("rka_handbook_read", "1"); } catch {}
  }, []);

  const WORKFLOW_CARDS = useMemo(() => {
    if (isMedicalDirector) {
      return [
        {
          icon: Stethoscope,
          title: "1. Medical Director Control Hub",
          desc: "Review supervising physician oversight, pending chart note counts, and active clinical injectors on floor.",
          link: "/staff/today",
          linkText: "View Control Hub",
          color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
        },
        {
          icon: FileCheck,
          title: "2. Clinical Reviews & Co-Signatures",
          desc: "Review and e-sign clinical chart notes, Good Faith Exams (GFE), and procedure notes submitted by RNs and NPs.",
          link: "/staff/clinical-reviews",
          linkText: "Open Co-sign Queue",
          color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
        },
        {
          icon: Pill,
          title: "3. Prescription Approvals",
          desc: "Authorize prescription requests, topical compounds, and oral medication refills submitted by clinical injectors.",
          link: "/staff/orders",
          linkText: "Review Prescriptions",
          color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
        },
        {
          icon: UserCheck,
          title: "4. Supervised Injectors Directory",
          desc: "View active clinical staff profiles, NP/RN credentials, and provider directory for the practice.",
          link: "/staff/team?tab=providers",
          linkText: "View Providers",
          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
        },
        {
          icon: BarChart3,
          title: "5. Clinical Governance Reports",
          desc: "Access clinical activity metrics, patient feedback ratings, and safety outcome reports.",
          link: "/staff/reports",
          linkText: "View Clinical Reports",
          color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
        },
        {
          icon: Stethoscope,
          title: "6. Digital Signature & License Credentials",
          desc: "Update your Medical Director title, CA license # (C152940), and draw your saved digital signature for auto-signing notes.",
          link: "/staff/me",
          linkText: "Edit Profile & Signature",
          color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900",
        },
      ];
    }

    if (isPrivacyOfficer) {
      return [
        {
          icon: ShieldAlert,
          title: "1. Security Officer Hub",
          desc: "Access HIPAA compliance overview, risk assessments, and breach management protocols.",
          link: "/staff/security-officer",
          linkText: "Compliance Hub",
          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
        },
        {
          icon: BookOpen,
          title: "2. HIPAA Policies & Manuals",
          desc: "Review and manage California CMIA 15-day rules, Privacy Notice (NPP), and workplace policies.",
          link: "/staff/hipaa-policies",
          linkText: "HIPAA Policies",
          color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
        },
        {
          icon: Building2,
          title: "3. Vendor & BAA Management",
          desc: "Track third-party vendors and verify signed Business Associate Agreements (BAAs).",
          link: "/staff/vendors",
          linkText: "Manage Vendors",
          color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
        },
        {
          icon: Laptop,
          title: "4. IT Devices & Hardware",
          desc: "Manage clinic iPads, workstations, full-disk encryption, and screen lock policies.",
          link: "/staff/vendors?tab=devices",
          linkText: "View IT Devices",
          color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
        },
        {
          icon: ShieldAlert,
          title: "5. Breach Incident Logs",
          desc: "Review security incident reports and 15-day CMIA notification timers.",
          link: "/staff/breach-report",
          linkText: "Incidents Log",
          color: "text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
        },
        {
          icon: Stethoscope,
          title: "6. Digital Signature & Profile",
          desc: "Set up your credentials, license details, and digital signature.",
          link: "/staff/me",
          linkText: "Edit Profile",
          color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
        },
      ];
    }

    return [
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
        title: "2. Patient Records & Appointments",
        desc: "Access client profiles, view upcoming bookings, and check-in patient visits.",
        link: "/staff/clients",
        linkText: "View Patients",
        color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
      },
      {
        icon: Stethoscope,
        title: "3. Digital Signature & Credentials",
        desc: "Set up your provider title, license number, and draw your saved digital signature for auto-signing chart notes.",
        link: "/staff/me",
        linkText: "Edit My Profile",
        color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
      },
    ];
  }, [isMedicalDirector, isPrivacyOfficer]);

  const FAQS = useMemo(() => {
    if (isMedicalDirector) {
      return [
        {
          q: "How do I co-sign chart notes and GFEs?",
          a: "Go to Clinical Reviews (/staff/clinical-reviews) -> Click 'Review & Sign' on any note awaiting supervising physician sign-off. Your saved digital signature will automatically populate.",
        },
        {
          q: "How do I approve prescription requests?",
          a: "Go to Prescriptions (/staff/orders) -> Click 'Approve & Sign' for topical compound or oral prescription requests submitted by clinical staff.",
        },
        {
          q: "How do I update my Medical License number and saved signature?",
          a: "Go to My Profile (/staff/me) -> Enter your CA License number (C152940) and draw your signature on the pad, then click 'Save signature'.",
        },
        {
          q: "Where do I view clinical governance reports?",
          a: "Go to Reports (/staff/reports) -> View completed treatment counts, provider clinical activity, patient satisfaction scores, and safety outcomes.",
        },
      ];
    }

    return [
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
  }, [isMedicalDirector]);

  return (
    <div className="w-[90%] max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase mb-2">
          <BookOpen className="h-4 w-4" /> {isMedicalDirector ? "Medical Director Handbook & Governance Guide" : "Staff Handbook & System Guide"}
        </div>
        <h1 className="font-serif text-3xl md:text-4xl mb-2">Welcome to Radiantilyk Aesthetic</h1>
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          {isMedicalDirector
            ? "Supervising physician governance manual. Learn how to review chart notes, co-sign GFEs, approve prescriptions, and monitor provider activity."
            : "Your day-to-day practice guide and software manual. Learn how to manage client appointments, report security incidents, manage IT devices, and update your provider profile."}
        </p>

        {/* Practice Meta Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 p-4 rounded-xl border border-border bg-card shadow-2xs">
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
            <div className="text-xs text-muted-foreground">Supervising Physician &amp; Clinical Oversight</div>
          </div>
        </div>
      </div>

      {/* System Workflows Grid */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          {isMedicalDirector ? "Medical Director Practice Workflows" : "Staff Workflows & Modules"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORKFLOW_CARDS.map((card, idx) => {
            const IconComp = card.icon;
            return (
              <Card key={idx} className="flex flex-col justify-between hover:border-primary/40 transition shadow-2xs rounded-2xl">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2.5 rounded-xl border ${card.color}`}>
                      <IconComp className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base font-serif font-medium leading-snug">{card.title}</CardTitle>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                    {card.desc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 mt-auto">
                  <Button asChild variant="outline" size="sm" className="w-full text-xs rounded-xl justify-between group">
                    <Link to={card.link}>
                      <span>{card.linkText}</span>
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* FAQs */}
      <div className="space-y-4 border-t border-border pt-6">
        <h2 className="font-serif text-xl flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-border bg-card space-y-1.5 shadow-2xs">
              <h3 className="text-xs font-semibold text-foreground flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{faq.q}</span>
              </h3>
              <p className="text-xs text-muted-foreground pl-6 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
