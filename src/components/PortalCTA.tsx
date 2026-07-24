import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

import { getClientSession } from "@/hooks/useClientAuth";

type Tab = "appointments" | "messages" | "forms" | "photos" | "profile";

// Shown on token-page success screens. If the visitor is already signed into
// their client portal, surface a single "go home" button so logged-in clients
// don't get stranded on a one-shot page.
export function PortalCTA({ tab = "appointments", label }: { tab?: Tab; label?: string }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    getClientSession().then((session) => {
      if (alive) setSignedIn(!!session);
    });
    return () => { alive = false; };
  }, []);
  if (!signedIn) return null;
  return (
    <Link to={`/account?tab=${tab}`} className="inline-block mt-6">
      <Button variant="outline" className="rounded-full">
        {label ?? "View in your portal"}
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </Link>
  );
}
