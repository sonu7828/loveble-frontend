import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import StaffAvailability from "./StaffAvailability";
import StaffTimeOff from "./StaffTimeOff";

const VALID = new Set(["availability", "time-off"]);

export default function StaffMySchedule() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") || "availability";
  const tab = VALID.has(raw) ? raw : "availability";
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="font-serif text-2xl">My Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">Set your weekly availability and request time off.</p>
      </header>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="availability">Weekly availability</TabsTrigger>
          <TabsTrigger value="time-off">Time off & extras</TabsTrigger>
        </TabsList>
        <TabsContent value="availability" className="mt-4">
          <StaffAvailability />
        </TabsContent>
        <TabsContent value="time-off" className="mt-4">
          <StaffTimeOff />
        </TabsContent>
      </Tabs>
    </div>
  );
}
