import { useEffect, useState } from "react";
import { patientAccountService, PatientAccountItem } from "@/services/api/patientAccountService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, UserPlus, Lock, Unlock, ShieldAlert, KeyRound, CheckCircle2, XCircle, AlertTriangle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function PatientAccountsView() {
  const { isPatientAccountManager, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<PatientAccountItem[]>([]);
  const [search, setSearch] = useState("");
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });

  // Temporary Password Modal State
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    open: boolean;
    title: string;
    email: string;
    temporaryPassword: string;
  }>({
    open: false,
    title: "",
    email: "",
    temporaryPassword: "",
  });
  const [copied, setCopied] = useState(false);

  const fetchAccounts = async (page = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const res = await patientAccountService.getPatientAccounts(searchQuery, page);
      setAccounts(res.accounts);
      setMeta({
        page: res.meta.page || 1,
        totalPages: res.meta.totalPages || 1,
        total: res.meta.total || 0,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load patient accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAccounts(1, search);
  };

  const handleCreateLogin = async (item: PatientAccountItem) => {
    setBusyId(item.patientProfileId);
    try {
      const res = await patientAccountService.createPatientLogin(item.patientProfileId);
      toast.success(`Login created for ${item.firstName} ${item.lastName}`);
      if (res.temporaryPassword) {
        setTempPasswordModal({
          open: true,
          title: `Patient Login Access Created — ${item.firstName} ${item.lastName}`,
          email: res.email,
          temporaryPassword: res.temporaryPassword,
        });
      }
      await fetchAccounts(meta.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to create login access");
    } finally {
      setBusyId(null);
    }
  };

  const handleActivate = async (item: PatientAccountItem) => {
    setBusyId(item.patientProfileId);
    try {
      await patientAccountService.activatePatientLogin(item.patientProfileId);
      toast.success(`Activated login for ${item.firstName} ${item.lastName}`);
      await fetchAccounts(meta.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to activate login");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeactivate = async (item: PatientAccountItem) => {
    setBusyId(item.patientProfileId);
    try {
      await patientAccountService.deactivatePatientLogin(item.patientProfileId);
      toast.success(`Deactivated login for ${item.firstName} ${item.lastName}`);
      await fetchAccounts(meta.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate login");
    } finally {
      setBusyId(null);
    }
  };

  const handleUnlock = async (item: PatientAccountItem) => {
    setBusyId(item.patientProfileId);
    try {
      await patientAccountService.unlockPatientAccount(item.patientProfileId);
      toast.success(`Unlocked account for ${item.firstName} ${item.lastName}`);
      await fetchAccounts(meta.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to unlock account");
    } finally {
      setBusyId(null);
    }
  };

  const handleResetAccess = async (item: PatientAccountItem) => {
    setBusyId(item.patientProfileId);
    try {
      const res = await patientAccountService.resetPatientAccess(item.patientProfileId);
      toast.success(`Access reset for ${item.firstName} ${item.lastName}`);
      setTempPasswordModal({
        open: true,
        title: `Patient Credentials Reset — ${item.firstName} ${item.lastName}`,
        email: res.email,
        temporaryPassword: res.temporaryPassword,
      });
      await fetchAccounts(meta.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset access");
    } finally {
      setBusyId(null);
    }
  };

  const handleForcePasswordChange = async (item: PatientAccountItem) => {
    setBusyId(item.patientProfileId);
    try {
      await patientAccountService.forcePasswordChange(item.patientProfileId);
      toast.success(`Forced password change enabled for ${item.firstName} ${item.lastName}`);
      await fetchAccounts(meta.page);
    } catch (err: any) {
      toast.error(err.message || "Failed to force password change");
    } finally {
      setBusyId(null);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPasswordModal.temporaryPassword);
    setCopied(true);
    toast.success("Temporary password copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isPatientAccountManager) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h1 className="text-2xl font-serif font-bold text-foreground">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You do not have Patient Account Manager privileges. Only Admin and delegated Patient Account Managers can access patient login management.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl">Patient Account Management</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold px-2.5 py-0.5">
              Identity & Access Control
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage patient login accounts, issue temporary credentials, activate/deactivate portal access, and force password updates.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name or email..."
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
          <p className="text-sm text-muted-foreground">No patient accounts found matching your query.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5 pl-5">Patient Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Login Account</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Lock Status</th>
                  <th className="p-3.5">Password Status</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.map((acc) => {
                  const isBusy = busyId === acc.patientProfileId;
                  return (
                    <tr key={acc.patientProfileId} className="hover:bg-muted/30 transition">
                      <td className="p-3.5 pl-5 font-medium text-foreground">
                        {acc.firstName} {acc.lastName}
                      </td>
                      <td className="p-3.5 text-muted-foreground font-mono">{acc.email}</td>
                      <td className="p-3.5">
                        {acc.hasUser ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Linked User
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            <XCircle className="w-3 h-3 mr-1" /> No User Account
                          </Badge>
                        )}
                      </td>
                      <td className="p-3.5">
                        {acc.hasUser ? (
                          acc.isActive ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                              Inactive
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {acc.hasUser ? (
                          acc.isLocked ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                              <Lock className="w-3 h-3 mr-1" /> Locked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              Unlocked
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {acc.hasUser ? (
                          acc.mustChangePassword ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              Change Required
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              Normal
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right pr-5 space-x-1.5 whitespace-nowrap">
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin inline-block text-primary" />
                        ) : !acc.hasUser ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleCreateLogin(acc)}
                            className="h-7 text-xs"
                          >
                            <UserPlus className="w-3 h-3 mr-1" /> Create Login Access
                          </Button>
                        ) : (
                          <>
                            {acc.isActive ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeactivate(acc)}
                                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleActivate(acc)}
                                className="h-7 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                              >
                                Activate
                              </Button>
                            )}

                            {acc.isLocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnlock(acc)}
                                className="h-7 text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                              >
                                <Unlock className="w-3 h-3 mr-1" /> Unlock
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetAccess(acc)}
                              className="h-7 text-xs"
                            >
                              <KeyRound className="w-3 h-3 mr-1" /> Reset Access
                            </Button>

                            {!acc.mustChangePassword && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleForcePasswordChange(acc)}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              >
                                Force Password Change
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="p-3.5 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing Page {meta.page} of {meta.totalPages} ({meta.total} total)</span>
              <div className="space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={meta.page <= 1}
                  onClick={() => fetchAccounts(meta.page - 1)}
                  className="h-7 text-xs"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => fetchAccounts(meta.page + 1)}
                  className="h-7 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Temporary Password Display Modal */}
      <Dialog open={tempPasswordModal.open} onOpenChange={(open) => setTempPasswordModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {tempPasswordModal.title}
            </DialogTitle>
            <DialogDescription>
              One-time temporary credentials issued for patient portal login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong>Important:</strong> This password is shown <strong>only once</strong>. The patient must change it after first login.
              </div>
            </div>

            <div className="space-y-2 bg-muted/60 p-4 rounded-xl border border-border">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Login Email</span>
                <p className="text-sm font-mono font-medium text-foreground">{tempPasswordModal.email}</p>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Temporary Password</span>
                <div className="flex items-center justify-between bg-background border border-border rounded-lg p-2.5 mt-1">
                  <span className="font-mono text-base font-bold tracking-wider text-primary select-all">
                    {tempPasswordModal.temporaryPassword}
                  </span>
                  <Button size="sm" variant="ghost" onClick={copyPassword} className="h-8 px-2 text-xs">
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => setTempPasswordModal((prev) => ({ ...prev, open: false }))}
            >
              Done & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
