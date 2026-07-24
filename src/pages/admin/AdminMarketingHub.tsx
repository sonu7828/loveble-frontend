import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import StaffMarketing from "../staff/StaffMarketing";
import StaffPerks from "../staff/StaffPerks";
import AdminPosConfig from "./AdminPosConfig";
import StaffNewsletter from "../staff/StaffNewsletter";

const VALID = new Set(["newsletter", "campaigns", "perks", "discounts"]);

export default function AdminMarketingHub() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") || "newsletter";
  const tab = VALID.has(raw) ? raw : "newsletter";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="font-serif text-2xl">Marketing &amp; Offers</h1>
        <p className="text-sm text-muted-foreground mt-1">One-shot newsletters, recurring campaigns, perks, and discount codes.</p>
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
          <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="perks">Birthday &amp; Anniversary</TabsTrigger>
          <TabsTrigger value="discounts">Discounts &amp; Promos</TabsTrigger>
        </TabsList>
        <TabsContent value="newsletter" className="mt-4"><StaffNewsletter /></TabsContent>
        <TabsContent value="campaigns" className="mt-4"><StaffMarketing /></TabsContent>
        <TabsContent value="perks" className="mt-4"><StaffPerks /></TabsContent>
        <TabsContent value="discounts" className="mt-4"><AdminPosConfig /></TabsContent>
      </Tabs>
    </div>
  );
}


