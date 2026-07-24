import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientAvatarProps {
  clientEmail: string;
  avatarPath: string | null | undefined;
  /** When true, clicking opens a file picker to upload/replace. */
  editable?: boolean;
  size?: number;
  className?: string;
  /** Called after a successful upload with the new storage path. */
  onChange?: (newPath: string) => void;
  fallbackInitials?: string;
}

const BUCKET = "client-avatars";

export function ClientAvatar({
  clientEmail,
  avatarPath,
  editable = false,
  size = 80,
  className,
  onChange,
  fallbackInitials,
}: ClientAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) { setUrl(null); return; }
    (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(avatarPath, 60 * 60);
      if (!cancelled && !error) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [avatarPath]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${clientEmail.toLowerCase()}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;

      // Update client record(s). Try both tables; ignore failures on the one that doesn't have a row.
      await Promise.all([
        supabase.from("imported_clients").update({ avatar_path: path }).eq("email", clientEmail.toLowerCase()),
        supabase.from("client_profiles").update({ avatar_path: path }).eq("email", clientEmail.toLowerCase()),
      ]);

      onChange?.(path);
      toast.success("Photo updated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const initials = (fallbackInitials || clientEmail.slice(0, 2)).toUpperCase();

  return (
    <div
      className={cn("relative rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0", editable && "cursor-pointer group", className)}
      style={{ width: size, height: size }}
      onClick={editable ? () => inputRef.current?.click() : undefined}
    >
      {url ? (
        <img src={url} alt="Client photo" className="w-full h-full object-cover" />
      ) : (
        <span className="text-foreground/70 font-medium" style={{ fontSize: size / 2.8 }}>
          {initials || <User className="h-1/2 w-1/2" />}
        </span>
      )}
      {editable && (
        <>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </>
      )}
    </div>
  );
}
