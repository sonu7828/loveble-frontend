import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  tipPct: number | null;
  setTipPct: (n: number | null) => void;
  tipCustom: string;
  setTipCustom: (v: string) => void;
  applyFee: boolean;
  setApplyFee: (v: boolean) => void;
};

export function TipPanel(p: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Tip</h2>
      <div className="flex flex-wrap gap-2">
        {[15, 20, 25].map((pct) => (
          <Button key={pct} variant={p.tipPct === pct ? "default" : "outline"} size="sm" onClick={() => { p.setTipPct(pct); p.setTipCustom(""); }}>{pct}%</Button>
        ))}
        <Button variant={p.tipPct === 0 ? "default" : "outline"} size="sm" onClick={() => { p.setTipPct(0); p.setTipCustom(""); }}>No tip</Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Custom $</span>
          <Input className="w-24 h-9" value={p.tipCustom} type="number" step="0.01" onChange={(e) => { p.setTipCustom(e.target.value); p.setTipPct(null); }} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={p.applyFee} onChange={(e) => p.setApplyFee(e.target.checked)} />
        Apply 3.5% processing fee (skipped for cash)
      </label>
    </section>
  );
}
