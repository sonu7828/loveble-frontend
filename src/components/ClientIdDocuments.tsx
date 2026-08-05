import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useRef, useState } from "react";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, FileImage, Trash2, Eye, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

type IdFile = { name: string; path: string; size: number; updated_at: string };

const BUCKET = "client-ids";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPT = "image/png,image/jpeg,image/webp,image/heic,application/pdf";

function emailToFolder(email: string) {
  return email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
}

export function ClientIdDocuments({ email }: { email: string }) {
  const folder = emailToFolder(email);
  const [files, setFiles] = useState<IdFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const emailKey = (email || "").toLowerCase().trim();
      const local: any[] = JSON.parse(localStorage.getItem(`rka_id_docs_${emailKey}`) || "[]");
      const { data } = await apiQuery("client_id_documents")
        .select("*")
        .eq("client_email", emailKey)
        .order("created_at", { ascending: false })
        .catch(() => ({ data: [] }));
      const combined = [...(data ?? []), ...local];
      const seen = new Set<string>();
      const list: IdFile[] = [];
      for (const f of combined) {
        const p = f.path || f.storage_path || f.name;
        if (!p || seen.has(p)) continue;
        seen.add(p);
        list.push({
          name: f.name || f.file_name || p,
          path: p,
          size: f.size || f.file_size || 1024,
          updated_at: f.updated_at || f.created_at || new Date().toISOString(),
        });
      }
      setFiles(list);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const onUpload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("File too large (max 10MB)");
      return;
    }
    setUploading(true);
    const emailKey = (email || "").toLowerCase().trim();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${safeName}`;
    const newDoc = {
      id: `doc-${Date.now()}`,
      client_email: emailKey,
      name: safeName,
      file_name: safeName,
      path: path,
      size: file.size,
      created_at: new Date().toISOString(),
    };

    const local: any[] = JSON.parse(localStorage.getItem(`rka_id_docs_${emailKey}`) || "[]");
    local.push(newDoc);
    localStorage.setItem(`rka_id_docs_${emailKey}`, JSON.stringify(local));

    try {
      await apiQuery("client_id_documents").insert(newDoc);
    } catch {}

    setUploading(false);
    toast.success("ID uploaded");
    if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const onView = async (path: string) => {
    const { data, error } = await ApiClient.createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Could not open file");
      return;
    }
    void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
      logPhiAccess({ resourceType: "client_id", clientEmail: email, action: "view", metadata: { path } })
    );
    toast.info("Document viewer opened");
  };

  const onDelete = async (path: string) => {
    if (!(await confirmDialog({ title: "Delete this ID document?", description: "This cannot be undone.", destructive: true, confirmLabel: "Delete" }))) return;
    const emailKey = (email || "").toLowerCase().trim();
    const local: any[] = JSON.parse(localStorage.getItem(`rka_id_docs_${emailKey}`) || "[]");
    const next = local.filter((x: any) => (x.path || x.name) !== path);
    localStorage.setItem(`rka_id_docs_${emailKey}`, JSON.stringify(next));

    try {
      await apiQuery("client_id_documents").delete().eq("client_email", emailKey).eq("path", path);
    } catch {}

    toast.success("Deleted");
    load();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">ID / Driver's License</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Staff only
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Private documents. Visible to staff only. JPG, PNG, WEBP, HEIC, or PDF. Max 10MB.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : files.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
          No ID on file yet.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <FileImage className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm truncate">{f.name.replace(/^\d+-/, "")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {(f.size / 1024).toFixed(0)} KB
                    {f.updated_at && ` · ${format(new Date(f.updated_at), "MMM d, yyyy")}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => onView(f.path)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(f.path)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
