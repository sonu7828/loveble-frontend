import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Check } from "lucide-react";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(254),
});

export default function NewsletterSignup({ source = "footer" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setStatus("error");
      setMsg(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setStatus("loading");
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: parsed.data.email, source });
    // Treat unique-violation as success ("you're already on the list").
    if (error && !/duplicate|unique/i.test(error.message)) {
      setStatus("error");
      setMsg("Couldn't subscribe — please try again.");
      return;
    }
    setStatus("done");
    setMsg("You're on the list ✨");
    setEmail("");
  };

  if (status === "done") {
    return (
      <p className="text-xs text-foreground inline-flex items-center gap-1.5" role="status" aria-live="polite">
        <Check className="h-3.5 w-3.5 text-primary" /> {msg}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" aria-label="Newsletter signup">
      <div className="flex items-stretch gap-2">
        <label htmlFor="newsletter-email" className="sr-only">Email address</label>
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            id="newsletter-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            maxLength={254}
            required
            aria-invalid={status === "error"}
            className="w-full rounded-full border border-border bg-background pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5 min-h-9"
        >
          {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Subscribe
        </button>
      </div>
      {msg && status === "error" && (
        <p className="text-[11px] text-destructive" role="alert">{msg}</p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Monthly notes on skincare, specials, and new services. Unsubscribe anytime.
      </p>
    </form>
  );
}
