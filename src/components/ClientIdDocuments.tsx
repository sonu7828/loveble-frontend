import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
      limit: 100,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) {
      toast.error("Could not load ID files");
      setFiles([]);
    } else {
      setFiles(
        (data ?? [])
          .filter((f) => f.name && !f.name.endsWith("/"))
          .map((f) => ({
            name: f.name,
            path: `${folder}/${f.name}`,
            size: (f.metadata as any)?.size ?? 0,
            updated_at: f.updated_at ?? f.created_at ?? "",
          }))
      );
    }
    setLoading(false);
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
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    setUploading(false);
    if (error) {
      toast.error(error.message || "Upload failed");
      return;
    }
    toast.success("ID uploaded");
    if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const onView = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Could not open file");
      return;
    }
    void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
      logPhiAccess({ resourceType: "client_id", clientEmail: email, action: "view", metadata: { path } })
    );
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const onDelete = async (path: string) => {
    if (!(await confirmDialog({ title: "Delete this ID document?", description: "This cannot be undone.", destructive: true, confirmLabel: "Delete" }))) return;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      toast.error("Delete failed");
      return;
    }
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
