import { ManualCardDialog } from "@/components/ManualCardDialog";
import { AffirmLinkDialog } from "@/components/AffirmLinkDialog";

type Props = {
  manualCard: { clientSecret: string; amountDueCents: number } | null;
  setManualCard: (v: null) => void;
  onManualPaid: () => any | Promise<any>;
  affirmLink: { url: string; amountDueCents: number } | null;
  setAffirmLink: (v: null) => void;
  saleId: string | null;
  defaultEmail: string;
  defaultName: string;
};

export function PaymentDialogs(p: Props) {
  return (
    <>
      <ManualCardDialog
        open={!!p.manualCard}
        onOpenChange={(v) => { if (!v) p.setManualCard(null); }}
        clientSecret={p.manualCard?.clientSecret ?? null}
        amountDueCents={p.manualCard?.amountDueCents ?? 0}
        onPaid={async () => {
          p.setManualCard(null);
          await p.onManualPaid();
        }}
      />
      <AffirmLinkDialog
        open={!!p.affirmLink}
        onOpenChange={(v) => { if (!v) p.setAffirmLink(null); }}
        paymentUrl={p.affirmLink?.url ?? null}
        amountDueCents={p.affirmLink?.amountDueCents ?? 0}
        saleId={p.saleId}
        defaultEmail={p.defaultEmail}
        defaultName={p.defaultName}
      />
    </>
  );
}
