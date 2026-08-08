import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "./shared";

type Props = {
  services: any[];
  unitServices: any[];
  products: any[];
  addService: (id: string) => void;
  addUnit: (svcId: string) => void;
  addProduct: (id: string) => void;
  addCustom: (label: string, priceDollars: string) => void;
  searchQ: string;
  setSearchQ: (v: string) => void;
  customLabel: string;
  setCustomLabel: (v: string) => void;
  customPrice: string;
  setCustomPrice: (v: string) => void;
};

const DEFAULT_CLINIC_SERVICES = [
  { id: "svc-glp1", name: "GLP-1 Wellness Management — Televisit", price_cents: 15000 },
  { id: "svc-hrt", name: "Hormone Replacement Therapy", price_cents: 15000 },
  { id: "svc-botox", name: "Neurotoxin / Botox", price_cents: 14000 },
  { id: "svc-facial", name: "Custom Medical Facial", price_cents: 12000 },
  { id: "svc-laser", name: "CO2 Laser Resurfacing", price_cents: 35000 },
  { id: "svc-microneedle", name: "RF Microneedling", price_cents: 25000 },
];

export function QuickAddPanel(p: Props) {
  const { services: rawServices, unitServices, products, addService, addUnit, addProduct, addCustom,
    searchQ, setSearchQ, customLabel, setCustomLabel, customPrice, setCustomPrice } = p;

  const services = rawServices.length > 0 ? rawServices : DEFAULT_CLINIC_SERVICES;

  type Tile = { key: string; label: string; sub: string; onClick: () => void };
  const tiles: Tile[] = [];
  
  const featured = services.filter((s: any) => s.is_featured);
  const displayServices = featured.length > 0 ? featured : services;

  for (const s of displayServices) {
    const u = unitServices.find((x) => x.service_id === s.id);
    if (u) {
      tiles.push({
        key: `u-${u.service_id}`,
        label: u.services?.name ?? s.name,
        sub: `${fmt(u.price_per_unit_cents)}/${u.unit_label}`,
        onClick: () => addUnit(u.service_id),
      });
    } else {
      tiles.push({
        key: `s-${s.id}`,
        label: s.name,
        sub: s.price_cents ? fmt(s.price_cents) : "Price varies",
        onClick: () => addService(s.id),
      });
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Quick add</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.slice(0, 8).map((t) => (
          <button key={t.key} onClick={t.onClick}
            className="text-left p-3 rounded-xl border border-border bg-background/50 hover:bg-secondary/60 hover:border-primary/40 transition cursor-pointer">
            <div className="text-sm font-medium truncate">{t.label}</div>
            <div className="text-[11px] text-muted-foreground">{t.sub}</div>
          </button>
        ))}
      </div>

      <div className="pt-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search all services, products, packages…"
            className="pl-9"
          />
        </div>
        {searchQ.trim().length > 0 && (() => {
          const q = searchQ.toLowerCase().trim();
          type Hit = { key: string; label: string; sub: string; onClick: () => void };
          const hits: Hit[] = [];
          for (const u of unitServices) {
            if ((u.services?.name ?? "").toLowerCase().includes(q)) {
              hits.push({ key: `u-${u.service_id}`, label: `${u.services?.name} (per ${u.unit_label})`, sub: `${fmt(u.price_per_unit_cents)}/${u.unit_label}`, onClick: () => { addUnit(u.service_id); setSearchQ(""); } });
            }
          }
          const unitIds = new Set(unitServices.map((u) => u.service_id));
          for (const s of services) {
            if (unitIds.has(s.id)) continue;
            if (s.name.toLowerCase().includes(q)) {
              hits.push({ key: `s-${s.id}`, label: s.name, sub: s.price_cents ? fmt(s.price_cents) : "Price varies", onClick: () => { addService(s.id); setSearchQ(""); } });
            }
          }
          for (const prod of products) {
            if (prod.name.toLowerCase().includes(q)) {
              hits.push({ key: `p-${prod.id}`, label: prod.name, sub: `${fmt(prod.price_cents)} · ${prod.kind}`, onClick: () => { addProduct(prod.id); setSearchQ(""); } });
            }
          }
          if (hits.length === 0) return <p className="text-xs text-muted-foreground mt-3">No matches.</p>;
          return (
            <ul className="mt-2 max-h-72 overflow-auto rounded-lg border border-border divide-y divide-border">
              {hits.slice(0, 30).map((h) => (
                <li key={h.key}>
                  <button onClick={h.onClick} className="w-full text-left px-3 py-2 hover:bg-secondary/60 flex items-center justify-between gap-3">
                    <span className="text-sm truncate">{h.label}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{h.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          );
        })()}
      </div>

      <div className="pt-3 mt-1 border-t border-border">
        <Label className="text-xs">Add custom service (off-menu)</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Service name (e.g. Custom touch-up)"
            className="flex-1"
          />
          <Input
            type="number" min={0} step="0.01"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder="Price $"
            className="w-28"
          />
          <Button
            variant="outline"
            onClick={() => { addCustom(customLabel, customPrice); setCustomLabel(""); setCustomPrice(""); }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Use for one-off services or prices not in the menu.</p>
      </div>
    </section>
  );
}
