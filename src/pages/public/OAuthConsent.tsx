import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function OAuthConsent() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Backend OAuth endpoint is not configured in this environment
    setError("Google Calendar integration is not configured yet.");
    setLoading(false);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-xl">Connect an app to Radiantilyk</h1>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            Loading authorization…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex gap-2">
            <Button className="flex-1" disabled>
              Approve
            </Button>
            <Button variant="outline" className="flex-1" disabled>
              Deny
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
