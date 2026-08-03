import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/usePageMeta";
import { confirmDialog } from "@/components/ui/confirm";
import { Users, Clock, CheckCircle, XCircle, Eye, Search, Check, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiQuery } from "@/services/api";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/40 dark:text-red-200",
};

export default function AdminModelApplications() {
  usePageMeta({ title: "Model Applications" });
  const [searchTerm, setSearchTerm] = useState("");
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadApplications = async () => {
    try {
      // 1. Fetch remote backend applications
      const { data } = await apiQuery("model_applications" as any).select("*");
      const remoteApps = Array.isArray(data) ? data : [];

      // 2. Fetch local storage applications
      const localApps = JSON.parse(localStorage.getItem("rka_demo_model_applications") || "[]");

      // 3. Merge uniquely by ID
      const map = new Map<string, any>();
      [...localApps, ...remoteApps].forEach((item) => {
        if (item && item.id && !map.has(item.id)) {
          map.set(item.id, item);
        }
      });

      setApplications(Array.from(map.values()));
    } catch (_err) {
      const localApps = JSON.parse(localStorage.getItem("rka_demo_model_applications") || "[]");
      setApplications(localApps);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: "approved" | "rejected") => {
    const updated = applications.map((app) =>
      app.id === id ? { ...app, status: newStatus } : app
    );
    setApplications(updated);

    // Update local storage
    const localApps = JSON.parse(localStorage.getItem("rka_demo_model_applications") || "[]");
    const updatedLocal = localApps.map((app: any) =>
      app.id === id ? { ...app, status: newStatus } : app
    );
    localStorage.setItem("rka_demo_model_applications", JSON.stringify(updatedLocal));

    // Update remote database
    try {
      await apiQuery("model_applications" as any).update({ id, status: newStatus });
    } catch (_err) {}

    toast.success(`Application ${id} marked as ${newStatus}`);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete Application",
      description: "Are you sure you want to delete this model application? This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setApplications((prev) => prev.filter((a) => a.id !== id));

    const localApps = JSON.parse(localStorage.getItem("rka_demo_model_applications") || "[]");
    const updatedLocal = localApps.filter((app: any) => app.id !== id);
    localStorage.setItem("rka_demo_model_applications", JSON.stringify(updatedLocal));

    try {
      await apiQuery("model_applications" as any).delete().eq("id", id);
    } catch (_err) {}

    toast.success("Application deleted successfully");
  };

  const filteredApplications = applications.filter((app) =>
    (app.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (app.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (app.procedures || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCount = applications.length;
  const pendingCount = applications.filter((a) => (a.status || "pending") === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Model Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage applicants for the clinical modeling program.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium">Total Applicants</h3>
          </div>
          <p className="text-2xl font-serif">{totalCount}</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-medium">Pending Review</h3>
          </div>
          <p className="text-2xl font-serif">{pendingCount}</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <h3 className="text-sm font-medium">Approved</h3>
          </div>
          <p className="text-2xl font-serif">{approvedCount}</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-medium">Rejected</h3>
          </div>
          <p className="text-2xl font-serif">{rejectedCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search applicants by name, email, or procedure..."
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
                  <td className="p-4 text-muted-foreground">{app.date || new Date(app.created_at || Date.now()).toLocaleDateString()}</td>
                  <td className="p-4">
                    <Badge className={STATUS_STYLES[app.status || "pending"]} variant="outline">
                      {(app.status || "pending").toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {app.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(app.id, "approved")}
                          className="h-8 px-2.5 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                      {app.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(app.id, "rejected")}
                          className="h-8 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost" className="h-8 rounded-full">
                        <Link to={`/staff/model-applications/${app.id}`}>
                          <Eye className="h-4 w-4 mr-1.5" /> View
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                        onClick={() => handleDelete(app.id)}
                        title="Delete application"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredApplications.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {loading ? "Loading applicants..." : "No model applications submitted yet."}
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
