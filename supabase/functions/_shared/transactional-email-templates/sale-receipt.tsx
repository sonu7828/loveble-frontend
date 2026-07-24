/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface ReceiptLine {
  label: string
  quantity?: number
  amountFormatted: string
}

interface Props {
  recipientName?: string
  saleNumber?: string
  paidOnFormatted?: string
  locationName?: string
  paymentMethodLabel?: string
  items: ReceiptLine[]
  subtotalFormatted?: string
  discountFormatted?: string
  tipFormatted?: string
  taxFormatted?: string
  processingFeeFormatted?: string
  voucherFormatted?: string
  totalFormatted: string
  refundedFormatted?: string
  netPaidFormatted?: string
  receiptPdfUrl?: string
  pointsEarned?: number
  pointsRedeemed?: number
  pointsRedeemedValueFormatted?: string
  pointsBalance?: number
  pointsBalanceValueFormatted?: string
}

const SaleReceiptEmail = ({
  recipientName = 'there',
  saleNumber = '',
  paidOnFormatted = '',
  locationName = '',
  paymentMethodLabel = '',
  items = [],
  subtotalFormatted,
  discountFormatted,
  tipFormatted,
  taxFormatted,
  processingFeeFormatted,
  voucherFormatted,
  totalFormatted = '$0.00',
  refundedFormatted,
  netPaidFormatted,
  receiptPdfUrl,
  pointsEarned,
  pointsRedeemed,
  pointsRedeemedValueFormatted,
  pointsBalance,
  pointsBalanceValueFormatted,
}: Props) => {
  const greetingName = recipientName && recipientName.trim() ? recipientName : 'there'
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #efe9e2',
    fontSize: '14px',
    color: '#2c241f',
  }
  const totalRowStyle: React.CSSProperties = {
    ...rowStyle,
    borderBottom: 'none',
    borderTop: '2px solid #2c241f',
    marginTop: '8px',
    paddingTop: '12px',
    fontSize: '16px',
    fontWeight: 600,
  }
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your Radiantilyk Aesthetic receipt — {totalFormatted}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Section style={{ textAlign: 'center' as const, margin: '0 0 12px' }}>
              <Img
                src="https://bookrka.com/receipt-logo.png"
                alt="Radiantilyk Aesthetic"
                width="96"
                height="96"
                style={{ display: 'inline-block', borderRadius: '12px' }}
              />
            </Section>
            <Text style={brandMark}>Radiantilyk Aesthetic</Text>
            <Heading style={h1}>Thank you, {greetingName}.</Heading>
            <Text style={text}>
              Your payment has been completed. Here's your receipt for your records.
            </Text>

            <Section style={{
              margin: '24px 0',
              padding: '20px',
              border: '1px solid #e5ddd4',
              borderRadius: '12px',
              background: '#faf6f1',
            }}>
              {paidOnFormatted ? (
                <Text style={{ ...text, fontSize: '13px', color: '#7a716c', margin: '0 0 4px' }}>
                  Paid on <strong style={{ color: '#2c241f' }}>{paidOnFormatted}</strong>
                </Text>
              ) : null}
              {locationName ? (
                <Text style={{ ...text, fontSize: '13px', color: '#7a716c', margin: '0 0 4px' }}>
                  Location <strong style={{ color: '#2c241f' }}>{locationName}</strong>
                </Text>
              ) : null}
              {paymentMethodLabel ? (
                <Text style={{ ...text, fontSize: '13px', color: '#7a716c', margin: '0 0 4px' }}>
                  Payment <strong style={{ color: '#2c241f' }}>{paymentMethodLabel}</strong>
                </Text>
              ) : null}
              {saleNumber ? (
                <Text style={{ ...text, fontSize: '12px', color: '#7a716c', margin: '8px 0 0', fontFamily: 'monospace' }}>
                  Ref: {saleNumber}
                </Text>
              ) : null}
            </Section>

            <Section style={{ margin: '8px 0 0' }}>
              {items.map((it, i) => (
                <div key={i} style={rowStyle}>
                  <span>
                    {it.label}
                    {it.quantity && it.quantity !== 1 ? ` × ${it.quantity}` : ''}
                  </span>
                  <span>{it.amountFormatted}</span>
                </div>
              ))}

              {subtotalFormatted ? (
                <div style={{ ...rowStyle, color: '#7a716c' }}>
                  <span>Subtotal</span><span>{subtotalFormatted}</span>
                </div>
              ) : null}
              {discountFormatted ? (
                <div style={{ ...rowStyle, color: '#7a716c' }}>
                  <span>Discount</span><span>−{discountFormatted}</span>
                </div>
              ) : null}
              {voucherFormatted ? (
                <div style={{ ...rowStyle, color: '#7a716c' }}>
                  <span>Gift card / voucher</span><span>−{voucherFormatted}</span>
                </div>
              ) : null}
              {taxFormatted ? (
                <div style={{ ...rowStyle, color: '#7a716c' }}>
                  <span>Tax</span><span>{taxFormatted}</span>
                </div>
              ) : null}
              {tipFormatted ? (
                <div style={{ ...rowStyle, color: '#7a716c' }}>
                  <span>Tip</span><span>{tipFormatted}</span>
                </div>
              ) : null}
              {processingFeeFormatted ? (
                <div style={{ ...rowStyle, color: '#7a716c' }}>
                  <span>Processing fee</span><span>{processingFeeFormatted}</span>
                </div>
              ) : null}
              {pointsRedeemed && pointsRedeemed > 0 ? (
                <div style={{ ...rowStyle, color: '#7a716c' }}>
                  <span>Points redeemed ({pointsRedeemed} pts)</span><span>−{pointsRedeemedValueFormatted}</span>
                </div>
              ) : null}
              <div style={totalRowStyle}>
                <span>Total charged</span><span>{totalFormatted}</span>
              </div>
              {refundedFormatted ? (
                <div style={{ ...rowStyle, color: '#7a716c', borderBottom: 'none' }}>
                  <span>Refunded</span><span>−{refundedFormatted}</span>
                </div>
              ) : null}
              {netPaidFormatted ? (
                <div style={{ ...totalRowStyle, borderTop: '1px solid #e5ddd4', fontSize: '15px' }}>
                  <span>Net paid</span><span>{netPaidFormatted}</span>
                </div>
              ) : null}
            </Section>

            {(pointsEarned || pointsRedeemed || pointsBalance != null) ? (
              <Section style={{
                margin: '20px 0 0',
                padding: '16px 18px',
                border: '1px solid #e5ddd4',
                borderRadius: '12px',
                background: '#fbf7f2',
              }}>
                <Text style={{ ...text, fontSize: '13px', fontWeight: 600, margin: '0 0 8px', color: '#2c241f' }}>
                  ✨ Rewards
                </Text>
                {pointsEarned ? (
                  <Text style={{ ...text, fontSize: '13px', color: '#5a4f48', margin: '0 0 4px' }}>
                    Earned this visit: <strong style={{ color: '#2c241f' }}>+{pointsEarned} pts</strong>
                  </Text>
                ) : null}
                {pointsRedeemed ? (
                  <Text style={{ ...text, fontSize: '13px', color: '#5a4f48', margin: '0 0 4px' }}>
                    Redeemed: <strong style={{ color: '#2c241f' }}>−{pointsRedeemed} pts</strong> ({pointsRedeemedValueFormatted} off)
                  </Text>
                ) : null}
                {pointsBalance != null ? (
                  <Text style={{ ...text, fontSize: '13px', color: '#5a4f48', margin: '6px 0 0', paddingTop: '6px', borderTop: '1px solid #efe9e2' }}>
                    Current balance: <strong style={{ color: '#2c241f' }}>{pointsBalance} pts</strong>
                    {pointsBalanceValueFormatted ? <> · worth {pointsBalanceValueFormatted}</> : null}
                  </Text>
                ) : null}
              </Section>
            ) : null}


            {receiptPdfUrl ? (
              <Section style={{ margin: '24px 0 0', textAlign: 'center' as const }}>
                <a
                  href={receiptPdfUrl}
                  style={{
                    display: 'inline-block',
                    padding: '12px 22px',
                    borderRadius: '999px',
                    background: '#2c241f',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Download PDF receipt
                </a>
              </Section>
            ) : null}

            <Section style={divider} />
            <Section style={{
              margin: '0 0 16px',
              padding: '14px 16px',
              border: '1px solid #e5ddd4',
              borderRadius: '10px',
              background: '#faf6f1',
            }}>
              <Text style={{ ...text, fontSize: '12px', fontWeight: 600, color: '#2c241f', margin: '0 0 6px' }}>
                Payment &amp; Refund Policy
              </Text>
              <Text style={{ ...text, fontSize: '11px', color: '#5a4f48', lineHeight: '1.55', margin: '0 0 6px' }}>
                <strong>All sales final.</strong> No refunds are given for services that have been rendered, in whole or in part. Payment confirms the client received and consented to the listed services.
              </Text>
              <Text style={{ ...text, fontSize: '11px', color: '#5a4f48', lineHeight: '1.55', margin: '0 0 6px' }}>
                Prepaid services, packages, gift cards, vouchers, and account credits are non-refundable, non-transferable, and have no cash value. Unused balances may be applied to future services at Radiantilyk Aesthetic only.
              </Text>
              <Text style={{ ...text, fontSize: '11px', color: '#5a4f48', lineHeight: '1.55', margin: '0 0 6px' }}>
                Cancellations require 48 hours' notice. Late cancellations and no-shows are subject to a $200 fee charged to the card on file. Results from aesthetic and medical services vary and are not guaranteed.
              </Text>
              <Text style={{ ...text, fontSize: '11px', color: '#5a4f48', lineHeight: '1.55', margin: '0 0 6px' }}>
                This email is a proof-of-payment receipt only. It is <strong>not</strong> a refund authorization, store credit, gift card, voucher, or transferable instrument, and may not be presented for cash, exchange, or credit.
              </Text>
              <Text style={{ ...text, fontSize: '11px', color: '#5a4f48', lineHeight: '1.55', margin: '0' }}>
                Disputed charges must be submitted in writing to <a href="mailto:kv@rkaglow.com" style={{ color: '#2c241f' }}>kv@rkaglow.com</a> within 7 calendar days of the paid-on date. Initiating a chargeback before contacting the clinic constitutes a breach of these terms.
              </Text>
            </Section>
            <Text style={footer}>
              Radiantilyk Aesthetic · 2100 Curtner Ave, Ste 1B, San Jose, CA<br />
              Questions about this charge? Reply to this email or write to kv@rkaglow.com.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SaleReceiptEmail,
  subject: (d: Record<string, any>) => `Your Radiantilyk Aesthetic receipt — ${d?.totalFormatted ?? ''}`.trim(),
  displayName: 'Sale receipt',
  previewData: {
    recipientName: 'Jane',
    saleNumber: 'ABCD-1234',
    paidOnFormatted: 'May 18, 2026 · 3:42 PM',
    locationName: 'San Jose',
    paymentMethodLabel: 'Card (Terminal)',
    items: [
      { label: 'Neurotoxin (Botox)', quantity: 24, amountFormatted: '$288.00' },
      { label: 'HydraFacial', quantity: 1, amountFormatted: '$185.00' },
    ],
    subtotalFormatted: '$473.00',
    tipFormatted: '$94.60',
    processingFeeFormatted: '$19.86',
    totalFormatted: '$587.46',
  },
} satisfies TemplateEntry
