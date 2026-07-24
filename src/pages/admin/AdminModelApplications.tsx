import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Users, Clock, CheckCircle, XCircle, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const MOCK_APPLICATIONS: any[] = [];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/40 dark:text-red-200",
};

export default function AdminModelApplications() {
  usePageMeta({ title: "Model Applications" });
  const [searchTerm, setSearchTerm] = useState("");

  const filteredApplications = MOCK_APPLICATIONS.filter((app) => 
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.procedures.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="font-serif text-3xl">Model Applications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage applicants for the clinical modeling program.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium">Total Applicants</h3>
          </div>
          <p className="text-2xl font-serif">0</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-medium">Pending Review</h3>
          </div>
          <p className="text-2xl font-serif">0</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <h3 className="text-sm font-medium">Approved</h3>
          </div>
          <p className="text-2xl font-serif">0</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-medium">Rejected</h3>
          </div>
          <p className="text-2xl font-serif">0</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search applicants..." 
              className="pl-9 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="p-4">Applicant</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4">Procedures of Interest</th>
                <th className="p-4">Date Applied</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredApplications.map((app) => (
                <tr key={app.id} className="hover:bg-muted/30 transition">
                  <td className="p-4">
                    <div className="font-medium text-foreground">{app.name}</div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{app.id}</div>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    <div>{app.email}</div>
                    <div className="text-xs">{app.phone}</div>
                  </td>
                  <td className="p-4 text-muted-foreground">{app.procedures}</td>
                  <td className="p-4 text-muted-foreground">{app.date}</td>
                  <td className="p-4">
                    <Badge className={STATUS_STYLES[app.status]} variant="outline">
                      {app.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button asChild size="sm" variant="ghost" className="rounded-full">
                      <Link to={`/staff/model-applications/${app.id}`}>
                        <Eye className="h-4 w-4 mr-1.5" /> View
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredApplications.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No applicants found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

