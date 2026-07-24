import { promptDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { functionErrorMessage } from "@/lib/functionError";

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function AdminPosConfig() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"unit" | "products" | "promos" | "vouchers">("unit");

  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Admin only.</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="font-serif text-3xl mb-2">POS Configuration</h1>
      <p className="text-sm text-muted-foreground mb-6">Per-unit services, retail products & packages, promo codes, and vouchers.</p>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {[
          ["unit", "Per-unit pricing"],
          ["products", "Products & Packages"],
          ["promos", "Promo Codes"],
          ["vouchers", "Vouchers / Gift Cards"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "unit" && <UnitTab />}
      {tab === "products" && <ProductsTab />}
      {tab === "promos" && <PromosTab />}
      {tab === "vouchers" && <VouchersTab />}
    </div>
  );
}

function UnitTab() {
  const [items, setItems] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [price, setPrice] = useState("12.00");
  const [unitLabel, setUnitLabel] = useState("unit");
  const [maxUnits, setMaxUnits] = useState("500");

  const load = async () => {
    const [{ data: us }, { data: svc }] = await Promise.all([
      supabase.from("unit_services").select("*, services(name)").order("created_at", { ascending: false }),
      supabase.from("services").select("id, name").eq("is_active", true).order("name"),
    ]);
    setItems(us ?? []); setServices(svc ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!serviceId) { toast.error("Pick a service"); return; }
    const { error } = await supabase.from("unit_services").insert({
      service_id: serviceId,
      price_per_unit_cents: Math.round(parseFloat(price) * 100),
      unit_label: unitLabel, min_units: 1, max_units: parseInt(maxUnits || "500"),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setServiceId(""); load();
  };
  const del = async (id: string) => {
    await supabase.from("unit_services").delete().eq("id", id); load();
  };

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium mb-3">Add per-unit pricing</h2>
        <p className="text-xs text-muted-foreground mb-3">Example: Botox at $12/unit. Filler at $750/syringe.</p>
        <div className="grid sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2"><Label className="text-xs">Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Pick a service" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Price / unit ($)</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><Label className="text-xs">Unit label</Label><Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="unit / syringe / ml" /></div>
          <div><Label className="text-xs">Max units</Label><Input value={maxUnits} onChange={(e) => setMaxUnits(e.target.value)} /></div>
        </div>
        <Button className="mt-3" onClick={add}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium mb-3">Configured</h2>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="divide-y divide-border">
            {items.map((u) => (
              <li key={u.id} className="py-2 flex items-center gap-3">
                <div className="flex-1"><div className="text-sm">{u.services?.name}</div>
                  <div className="text-xs text-muted-foreground">{fmt(u.price_per_unit_cents)} per {u.unit_label} · max {u.max_units}</div></div>
                <button onClick={() => del(u.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ProductsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<"retail" | "package" | "service_addon">("package");

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("display_order").order("name");
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name || !price) return;
    const { error } = await supabase.from("products").insert({
      name, price_cents: Math.round(parseFloat(price) * 100), kind, is_active: true,
      taxable: kind === "retail", tippable: kind !== "retail",
    });
    if (error) { toast.error(error.message); return; }
    setName(""); setPrice(""); load();
  };
  const toggle = async (id: string, v: boolean) => {
    await supabase.from("products").update({ is_active: v }).eq("id", id); load();
  };

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium mb-3">Add product / package</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <Input className="sm:col-span-2" placeholder="Name (e.g. Botox 30u Promo)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Price $" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="package">Package</SelectItem>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="service_addon">Service add-on</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="mt-3" onClick={add}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="divide-y divide-border">
            {items.map((p) => (
              <li key={p.id} className="py-2 flex items-center gap-3">
                <div className="flex-1"><div className="text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{fmt(p.price_cents)} · {p.kind}</div></div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <input type="checkbox" checked={p.is_active} onChange={(e) => toggle(p.id, e.target.checked)} /> Active
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function PromosTab() {
  const [items, setItems] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed" | "package_price">("percent");
  const [val, setVal] = useState("");
  const [minUnits, setMinUnits] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState("");

  const load = async () => {
    const [{ data: pc }, { data: svc }] = await Promise.all([
      supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("services").select("id, name").eq("is_active", true).order("name"),
    ]);
    setItems(pc ?? []); setServices(svc ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!code || !label || !val) return;
    const row: any = { code: code.toUpperCase(), label, kind, is_active: true, applies_to: serviceId ? `service:${serviceId}` : "all", conditions: {} };
    if (kind === "percent") row.value_pct = parseFloat(val);
    else { row.value_cents = Math.round(parseFloat(val) * 100); }
    if (kind === "package_price" && minUnits) row.conditions = { min_units: parseInt(minUnits) };
    const { error } = await supabase.from("promo_codes").insert(row);
    if (error) { toast.error(error.message); return; }
    setCode(""); setLabel(""); setVal(""); setMinUnits(""); load();
  };
  const toggle = async (id: string, v: boolean) => {
    await supabase.from("promo_codes").update({ is_active: v }).eq("id", id); load();
  };

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium mb-3">Add promo code</h2>
        <p className="text-xs text-muted-foreground mb-3">Example: code <strong>BOTOX259</strong>, kind "Package price", value $259, min units 30, applies to Botox service.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input placeholder="Code (e.g. BOTOX259)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percent off</SelectItem>
              <SelectItem value="fixed">Fixed amount off</SelectItem>
              <SelectItem value="package_price">Package price (replace)</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder={kind === "percent" ? "Value %" : "Value $"} value={val} onChange={(e) => setVal(e.target.value)} />
          {kind === "package_price" && <Input placeholder="Min units" value={minUnits} onChange={(e) => setMinUnits(e.target.value)} />}
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger><SelectValue placeholder="Service (optional)" /></SelectTrigger>
            <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button className="mt-3" onClick={add}><Plus className="h-4 w-4 mr-1.5" />Add</Button>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="divide-y divide-border">
            {items.map((p) => (
              <li key={p.id} className="py-2 flex items-center gap-3">
                <div className="flex-1"><div className="text-sm font-medium">{p.code} · {p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.kind === "percent" ? `${p.value_pct}% off` : `${fmt(p.value_cents ?? 0)}`} · {p.applies_to} {p.conditions?.min_units ? `· min ${p.conditions.min_units} units` : ""} · used {p.used_count}{p.max_uses ? `/${p.max_uses}` : ""}</div></div>
                <label className="text-xs flex items-center gap-1.5"><input type="checkbox" checked={p.is_active} onChange={(e) => toggle(p.id, e.target.checked)} />Active</label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

type Entitlement = { service_id?: string; service_name: string; quantity: number; unit_label?: string };

function VouchersTab() {
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [amount, setAmount] = useState("0");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"purchased" | "comp" | "refund_credit">("comp");
  const [locationId, setLocationId] = useState<string>("");
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [vRes, lRes, sRes] = await Promise.all([
      supabase.from("vouchers").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("locations").select("id,name").eq("is_active", true).order("name"),
      supabase.from("services").select("id,name,price_note").eq("is_active", true).order("name"),
    ]);
    setItems(vRes.data ?? []);
    setLocations(lRes.data ?? []);
    setServices(sRes.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const addEntitlement = () => setEntitlements((e) => [...e, { service_name: "", quantity: 1, unit_label: "session" }]);
  const updateEnt = (i: number, patch: Partial<Entitlement>) =>
    setEntitlements((e) => e.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeEnt = (i: number) => setEntitlements((e) => e.filter((_, idx) => idx !== i));

  const add = async () => {
    const parsed = parseFloat((amount || "0").replace(/[^0-9.]/g, ""));
    const cents = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
    const cleanEnt = entitlements
      .filter((e) => e.service_name.trim() && e.quantity > 0)
      .map((e) => ({
        service_name: e.service_name.trim(),
        quantity: Number(e.quantity),
        unit_label: e.unit_label?.trim() || undefined,
        service_id: e.service_id || undefined,
      }));
    if (cents < 100 && cleanEnt.length === 0) {
      toast.error("Add a dollar amount or at least one service entitlement");
      return;
    }
    const { data, error } = await supabase.functions.invoke("vouchers-issue", {
      body: {
        amountCents: cents,
        issuedToEmail: email || undefined,
        issuedToName: name || undefined,
        source,
        locationId: locationId || undefined,
        entitlements: cleanEnt,
      },
    });
    if (error || data?.error) {
      const msg = error ? await functionErrorMessage(error, "Could not issue voucher") : (data?.error ?? "Could not issue voucher");
      toast.error(msg);
      return;
    }
    toast.success(`Voucher ${data.voucher.code} created — valid 60 days`);
    setEmail(""); setName(""); setEntitlements([]); setAmount("0");
    await load();
    downloadVoucher(data.voucher);
  };

  const entitlementsLine = (v: any) =>
    Array.isArray(v.entitlements) && v.entitlements.length
      ? v.entitlements.map((e: Entitlement) => `${e.quantity} ${e.unit_label || ""} ${e.service_name}`.replace(/\s+/g, " ").trim()).join(" • ")
      : "";

  const locationName = (id?: string | null) => locations.find((l) => l.id === id)?.name ?? "";

  const downloadVoucher = (v: any) => {
    const expires = v.expires_at ? new Date(v.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";
    const ent = entitlementsLine(v);
    const loc = locationName(v.location_id);
    const valueBlock = ent
      ? `<div class="label">Redeemable for</div><div style="font-size:18px;line-height:1.4;margin:4px 0 8px;">${ent}</div>`
      : `<div class="label">Value</div><div class="amount">$${(v.balance_cents / 100).toFixed(2)}</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Gift Card ${v.code}</title>
<style>
  @page { size: 6in 4in; margin: 0; }
  body { font-family: Georgia, serif; margin: 0; background: #faf6f1; color: #2c241f; }
  .card { width: 6in; min-height: 4in; box-sizing: border-box; padding: 0.5in; border: 2px solid #c97c5d; background: linear-gradient(135deg, #faf6f1, #f0e6d8); display: flex; flex-direction: column; justify-content: space-between; }
  .brand { letter-spacing: 0.2em; font-size: 11px; text-transform: uppercase; color: #7a716c; }
  h1 { font-family: Georgia, serif; font-weight: 400; font-size: 28px; margin: 8px 0 4px; }
  .amount { font-size: 44px; font-weight: 600; margin: 4px 0; }
  .label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #7a716c; }
  .code { font-family: 'Courier New', monospace; font-size: 22px; letter-spacing: 0.15em; margin-top: 4px; }
  .meta { font-size: 11px; color: #7a716c; }
  .actions { margin-top: 12px; }
  button { padding: 8px 16px; border: 1px solid #2c241f; background: #2c241f; color: #faf6f1; cursor: pointer; font: inherit; }
</style></head><body>
<div style="padding:24px">
  <div class="card">
    <div>
      <div class="brand">Radiantilyk Aesthetic</div>
      <h1>Gift Card</h1>
    </div>
    <div>
      ${valueBlock}
      <div class="label">Code</div>
      <div class="code">${v.code}</div>
    </div>
    <div class="meta">
      Single redemption · valid through ${expires}<br/>
      ${loc ? `Redeemable at ${loc}` : "Present at checkout — San Jose"}
    </div>
  </div>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=720,height=560");
    if (!w) { toast.error("Pop-up blocked — allow pop-ups to download"); return; }
    w.document.write(html); w.document.close();
  };

  const emailVoucher = async (v: any) => {
    const to = await promptDialog({ title: "Send gift card", description: "Recipient email:", placeholder: "name@example.com", defaultValue: v.issued_to_email ?? "", required: true });
    if (!to) return;
    const name = (await promptDialog({ title: "Recipient name (optional)", placeholder: "Full name", defaultValue: v.issued_to_name ?? "" })) ?? "";
    setBusyId(v.id);
    const { data, error } = await supabase.functions.invoke("vouchers-email", {
      body: {
        voucherId: v.id,
        recipientEmail: to.trim().toLowerCase(),
        recipientName: name.trim() || undefined,
      },
    });
    setBusyId(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Email failed"); return; }
    toast.success(`Sent to ${to}`);
    load();
  };

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium mb-1">Issue voucher / gift card</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Admin only. Vouchers expire <strong>60 days</strong> from issue and are <strong>single use</strong>.
          Tie a voucher to a location and add specific service entitlements (e.g. 30 units of Botox, 1 pen Microneedling, Ultherapy Prime, CO₂ Laser, RF Microneedling).
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-xs">Location</Label>
            <Select value={locationId || "any"} onValueChange={(v) => setLocationId(v === "any" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Any location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any location (San Jose)</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comp">Comp / gift</SelectItem>
                <SelectItem value="purchased">Purchased</SelectItem>
                <SelectItem value="refund_credit">Refund credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <Input placeholder="Recipient name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Recipient email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Dollar value $ (optional if using services)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="rounded-lg border border-border p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium">Service entitlements</div>
            <Button size="sm" variant="outline" onClick={addEntitlement}><Plus className="h-3.5 w-3.5 mr-1" />Add item</Button>
          </div>
          {entitlements.length === 0 ? (
            <p className="text-xs text-muted-foreground">No service items. Add e.g. <em>30 units · Botox</em> or <em>1 pen · Microneedling</em>.</p>
          ) : (
            <ul className="space-y-2">
              {entitlements.map((e, i) => (
                <li key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-2"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={e.quantity}
                    onChange={(ev) => updateEnt(i, { quantity: parseFloat(ev.target.value || "0") })}
                  />
                  <Input
                    className="col-span-3"
                    placeholder="unit (units, pen, session, syringe)"
                    value={e.unit_label ?? ""}
                    onChange={(ev) => updateEnt(i, { unit_label: ev.target.value })}
                  />
                  <Select
                    value={e.service_id ?? "custom"}
                    onValueChange={(val) => {
                      if (val === "custom") { updateEnt(i, { service_id: undefined }); return; }
                      const svc = services.find((s) => s.id === val);
                      updateEnt(i, { service_id: val, service_name: svc?.name ?? e.service_name });
                    }}
                  >
                    <SelectTrigger className="col-span-4"><SelectValue placeholder="Pick service" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">— custom name —</SelectItem>
                      {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.price_note ? ` (${s.price_note})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    className="col-span-2"
                    placeholder="Service name"
                    value={e.service_name}
                    onChange={(ev) => updateEnt(i, { service_name: ev.target.value })}
                  />
                  <Button size="icon" variant="ghost" className="col-span-1" onClick={() => removeEnt(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button onClick={add}><Plus className="h-4 w-4 mr-1.5" />Issue voucher</Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="divide-y divide-border">
            {items.map((v) => {
              const expired = v.expires_at && new Date(v.expires_at) < new Date();
              const closed = !v.is_active || v.balance_cents <= 0;
              const ent = entitlementsLine(v);
              const loc = locationName(v.location_id);
              return (
                <li key={v.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-sm font-mono">{v.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {ent ? <><strong>{ent}</strong> · </> : <>Balance {fmt(v.balance_cents)} of {fmt(v.original_amount_cents)} · </>}
                      {loc ? `${loc} · ` : ""}{v.source}
                      {v.issued_to_email ? ` · ${v.issued_to_email}` : ""}
                      {v.expires_at ? ` · expires ${new Date(v.expires_at).toLocaleDateString()}` : ""}
                      {closed ? " · CLOSED" : expired ? " · EXPIRED" : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadVoucher(v)}>Download</Button>
                  <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => emailVoucher(v)}>
                    {busyId === v.id ? "Sending…" : "Email"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}


