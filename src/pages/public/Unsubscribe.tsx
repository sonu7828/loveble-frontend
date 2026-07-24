import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "done" | "submitting" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.valid === false) {
          if (data?.reason === "already_used" || data?.alreadyUnsubscribed) setState("already");
          else setState("invalid");
          return;
        }
        if (data?.email) setEmail(data.email);
        setState(data?.alreadyUnsubscribed ? "already" : "valid");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setState(error ? "error" : "done");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center">
        <h1 className="font-serif text-3xl mb-4">Radiantilyk Aesthetic</h1>
        {state === "loading" && <p className="text-muted-foreground">Checking your link…</p>}
        {state === "valid" && (
          <>
            <h2 className="text-xl font-medium mb-2">Unsubscribe from emails</h2>
            <p className="text-muted-foreground mb-6">
              {email ? <>You'll stop receiving non-essential emails at <strong>{email}</strong>.</> : "You'll stop receiving non-essential emails."}
            </p>
            <Button onClick={confirm}>Confirm unsubscribe</Button>
          </>
        )}
        {state === "submitting" && <p className="text-muted-foreground">Updating your preferences…</p>}
        {state === "done" && (
          <>
            <h2 className="text-xl font-medium mb-2">You're unsubscribed</h2>
            <p className="text-muted-foreground">We won't send you any more non-essential emails.</p>
          </>
        )}
        {state === "already" && (
          <>
            <h2 className="text-xl font-medium mb-2">Already unsubscribed</h2>
            <p className="text-muted-foreground">This email address is already opted out.</p>
          </>
        )}
        {state === "invalid" && (
          <>
            <h2 className="text-xl font-medium mb-2">Link not valid</h2>
            <p className="text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
          </>
        )}
        {state === "error" && (
          <>
            <h2 className="text-xl font-medium mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">Please try again in a moment.</p>
            <Button onClick={confirm}>Retry</Button>
          </>
        )}
      </div>
    </main>
  );
}
