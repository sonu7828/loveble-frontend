import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { NEUROTOXIN_PRODUCTS, FILLER_PRODUCTS } from "@/lib/clinicalOptions";
import { BarcodeScannerButton } from "@/components/clinical/BarcodeScannerButton";

type Props = {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  defaultProduct?: string;
  defaultCategory?: string;
  defaultUnit?: string;
  onReceived?: (lotId: string) => void;
};

const KNOWN_PRODUCTS = Array.from(new Set([
  ...NEUROTOXIN_PRODUCTS,
  ...FILLER_PRODUCTS,
  "Semaglutide (compounded)", "Tirzepatide (compounded)",
  "B12 (cyanocobalamin)", "Lidocaine 1%", "Hyaluronidase",
])).sort();

export function ReceiveLotDialog({
  open, onOpenChange, defaultProduct = "", defaultCategory, defaultUnit = "unit", onReceived,
}: Props) {
  const [product, setProduct] = useState(defaultProduct);
  const [lotNumber, setLotNumber] = useState("");
  const [expDate, setExpDate] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(defaultUnit);
  const [threshold, setThreshold] = useState("");
  const [notes, setNotes] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProduct(defaultProduct);
      setLotNumber(""); setExpDate(""); setQty(""); setNotes("");
      setUnit(defaultUnit);
      setThreshold("");
      supabase.from("locations").select("id, name").eq("is_active", true).order("name")
        .then(({ data }) => setLocations(data ?? []));
    }
  }, [open, defaultProduct, defaultUnit]);

  const save = async () => {
    if (!product.trim() || !lotNumber.trim() || !qty) {
      toast.error("Product, lot # and quantity required");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("receive_lot", {
      _product_name: product.trim(),
      _lot_number: lotNumber.trim(),
      _expiration_date: expDate || null,
      _quantity: Number(qty),
      _unit: unit || "unit",
      _category: defaultCategory ?? null,
      _location_id: locationId || null,
      _low_stock_threshold: threshold ? Number(threshold) : 0,
      _notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Received ${qty} ${unit} of ${product}`);
    onReceived?.(data as string);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receive new lot</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Product *</Label>
            <Input
              list="known-products"
              value={product}
              onChange={e => setProduct(e.target.value)}
              placeholder="e.g. Botox, Juvederm Voluma XC"
            />
            <datalist id="known-products">
              {KNOWN_PRODUCTS.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Lot # *</Label>
                <BarcodeScannerButton
                  label="Scan"
                  onScan={(t) => setLotNumber(t)}
                  onExpiration={(d) => setExpDate(d)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-input inline-flex items-center gap-1 hover:bg-muted"
                />
              </div>
              <Input value={lotNumber} onChange={e => setLotNumber(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Expiration</Label>
              <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Quantity *</Label>
              <Input type="number" inputMode="decimal" step="0.1" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="unit">unit</option>
                <option value="syringe">syringe</option>
                <option value="vial">vial</option>
                <option value="ml">ml</option>
                <option value="dose">dose</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Low-stock alert at</Label>
              <Input type="number" inputMode="decimal" step="0.1" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={locationId} onChange={e => setLocationId(e.target.value)}>
              <option value="">— Any —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="PO #, vendor, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Receive lot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
