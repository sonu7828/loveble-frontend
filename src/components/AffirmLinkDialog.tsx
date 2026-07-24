import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Mail, ExternalLink, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AffirmLinkDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentUrl: string | null;
  amountDueCents: number;
  saleId: string | null;
  defaultEmail?: string;
  defaultName?: string;
  locationName?: string;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export function AffirmLinkDialog({
  open, onOpenChange, paymentUrl, amountDueCents, saleId, defaultEmail, defaultName, locationName,
}: AffirmLinkDialogProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!paymentUrl) return;
    await navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!paymentUrl || !saleId) return;
    if (!email.trim()) { toast.error("Enter an email"); return; }
    setSending(true);
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "affirm-payment-link",
        recipientEmail: email.trim(),
        idempotencyKey: `affirm-link-${saleId}-${Date.now()}`,
        templateData: {
          recipientName: defaultName || "there",
          amountFormatted: fmt(amountDueCents),
          paymentUrl,
          locationName,
        },
      },
    });
    setSending(false);
    if (error) { toast.error(error.message || "Could not send email"); return; }
    setSent(true);
    toast.success(`Payment link sent to ${email.trim()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Affirm payment link</DialogTitle>
          <DialogDescription>
            Have the client scan the QR or email them the link. The sale will mark <strong>Completed</strong> automatically once Affirm approves and the client confirms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center gap-3">
            {paymentUrl ? (
              <>
                <div className="bg-white p-3 rounded-lg border border-border">
                  <QRCodeSVG value={paymentUrl} size={200} level="M" />
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount</div>
                  <div className="text-2xl font-medium tabular-nums">{fmt(amountDueCents)}</div>
                </div>
              </>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleCopy} disabled={!paymentUrl}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button variant="outline" asChild disabled={!paymentUrl}>
              <a href={paymentUrl ?? "#"} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Open
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email the link to client</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSent(false); }}
                placeholder="client@example.com"
              />
              <Button onClick={handleSendEmail} disabled={sending || !email.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <Check className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Affirm requires the client to enter their own details (DOB, last 4 of SSN) — best done on their phone.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
