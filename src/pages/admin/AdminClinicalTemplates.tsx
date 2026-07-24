import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import StaffConsents from "../staff/StaffConsents";
import StaffOpInstructions from "../staff/StaffOpInstructions";
import StaffQuickPhrases from "../staff/StaffQuickPhrases";

const VALID = new Set(["consents", "pre-op", "post-op", "quick-phrases", "protocols"]);

export default function AdminClinicalTemplates() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") || "consents";
  const tab = VALID.has(raw) ? raw : "consents";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="font-serif text-2xl">Templates &amp; Phrases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consents, instructions, quick phrases, and clinical protocols — one place to manage canned content.
        </p>
      </header>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="consents">Consent forms</TabsTrigger>
          <TabsTrigger value="pre-op">Pre-op</TabsTrigger>
          <TabsTrigger value="post-op">Post-op</TabsTrigger>
          <TabsTrigger value="quick-phrases">Quick phrases</TabsTrigger>
          <TabsTrigger value="protocols">Protocols</TabsTrigger>
        </TabsList>
        <TabsContent value="consents" className="mt-4"><StaffConsents /></TabsContent>
        <TabsContent value="pre-op" className="mt-4"><StaffOpInstructions kind="pre" embedded /></TabsContent>
        <TabsContent value="post-op" className="mt-4"><StaffOpInstructions kind="post" embedded /></TabsContent>
        <TabsContent value="quick-phrases" className="mt-4"><StaffQuickPhrases /></TabsContent>
        <TabsContent value="protocols" className="mt-4">
          <div className="rounded-lg border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Clinical protocols have their own editor and version history.
            </p>
            <Button asChild>
              <Link to="/staff/clinical/protocols">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Open Protocols
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


