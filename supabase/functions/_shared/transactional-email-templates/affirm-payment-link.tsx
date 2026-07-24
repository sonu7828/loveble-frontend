/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brand, brandMark, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  amountFormatted: string
  paymentUrl: string
  locationName?: string
}

const AffirmPaymentLinkEmail = ({
  recipientName = 'there',
  amountFormatted = '$0.00',
  paymentUrl = '#',
  locationName,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Pay {amountFormatted} with Affirm — Radiantilyk Aesthetic</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandMark}>Radiantilyk Aesthetic</Section>
        <Section style={card}>
          <Heading style={h1}>Complete your payment with Affirm</Heading>
          <Text style={text}>
            Hi {recipientName}, thank you for visiting{locationName ? ` our ${locationName} studio` : ' Radiantilyk Aesthetic'}.
            Tap the button below to pay your balance of <strong>{amountFormatted}</strong> with Affirm — choose a payment plan that works for you, with no surprises.
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button
              href={paymentUrl}
              style={{
                backgroundColor: brand.primary,
                color: brand.primaryFg,
                padding: '14px 28px',
                borderRadius: '999px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Pay {amountFormatted} with Affirm
            </Button>
          </Section>
          <Text style={{ ...text, fontSize: '13px', color: brand.muted }}>
            Or copy and paste this link into your browser:<br />
            <a href={paymentUrl} style={{ color: brand.primary, wordBreak: 'break-all' }}>{paymentUrl}</a>
          </Text>
          <Section style={divider} />
          <Text style={{ ...text, fontSize: '12px', color: brand.muted }}>
            Affirm payment plans are subject to approval. This payment link is single-use and will expire after 24 hours. If you didn't request this, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={footer}>Radiantilyk Aesthetic · San Jose · San Mateo</Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AffirmPaymentLinkEmail,
  subject: (data: any) => `Pay ${data?.amountFormatted ?? 'your balance'} with Affirm`,
  displayName: 'Affirm payment link',
  previewData: {
    recipientName: 'Jane',
    amountFormatted: '$450.00',
    paymentUrl: 'https://checkout.stripe.com/c/pay/example',
    locationName: 'San Jose',
  },
} satisfies TemplateEntry
