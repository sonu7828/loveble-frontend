/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  code: string
  amountFormatted?: string
  entitlements?: string[]
  expiresOnFormatted: string
  fromName?: string
  message?: string
}

const VoucherGiftCardEmail = ({
  recipientName = 'there',
  code = 'GC-XXXXXXXX',
  amountFormatted = '',
  entitlements = [],
  expiresOnFormatted = '',
  fromName,
  message,
}: Props) => {
  const hasAmount = !!amountFormatted
  const hasEntitlements = entitlements.length > 0
  const previewValue = hasAmount ? amountFormatted : (entitlements[0] || 'gift')
  const greetingName = recipientName && recipientName.trim() ? recipientName : 'there'
  return (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Your ${previewValue} Radiantilyk Aesthetic gift`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>A gift for you, {greetingName}.</Heading>
          {fromName ? (
            <Text style={text}>{fromName} sent you a gift to enjoy at Radiantilyk Aesthetic.</Text>
          ) : (
            <Text style={text}>You've received a gift to enjoy at Radiantilyk Aesthetic.</Text>
          )}
          {message ? <Text style={{ ...text, fontStyle: 'italic' }}>"{message}"</Text> : null}

          <Section style={{
            margin: '24px 0',
            padding: '24px',
            border: '1px solid #e5ddd4',
            borderRadius: '12px',
            textAlign: 'center',
            background: '#faf6f1',
          }}>
            {hasAmount ? (
              <>
                <Text style={{ ...text, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a716c', margin: '0 0 8px' }}>Gift card value</Text>
                <Text style={{ ...text, fontSize: '32px', fontWeight: 600, margin: '0 0 16px', color: '#2c241f' }}>{amountFormatted}</Text>
              </>
            ) : null}
            {hasEntitlements ? (
              <>
                <Text style={{ ...text, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a716c', margin: hasAmount ? '8px 0 8px' : '0 0 8px' }}>Included</Text>
                {entitlements.map((line, i) => (
                  <Text key={i} style={{ ...text, fontSize: '18px', fontWeight: 500, margin: '0 0 4px', color: '#2c241f' }}>{line}</Text>
                ))}
                <Text style={{ ...text, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a716c', margin: '16px 0 6px' }}>Code</Text>
              </>
            ) : (
              <Text style={{ ...text, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a716c', margin: '0 0 6px' }}>Code</Text>
            )}
            <Text style={{ ...text, fontFamily: 'monospace', fontSize: '20px', letterSpacing: '0.12em', margin: '0', color: '#2c241f' }}>{code}</Text>
          </Section>

          <Text style={text}>
            Present this code at checkout in San Jose or San Mateo. Single redemption — once redeemed the card is closed.
          </Text>
          {expiresOnFormatted ? (
            <Text style={{ ...text, fontSize: '13px', color: '#7a716c' }}>
              Valid through <strong>{expiresOnFormatted}</strong> (60 days from issue).
            </Text>
          ) : null}

          <Section style={divider} />
          <Text style={footer}>
            Radiantilyk Aesthetic · San Jose & San Mateo<br />
            Questions? Reply to this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
  )
}

export const template = {
  component: VoucherGiftCardEmail,
  subject: (d: Record<string, any>) => {
    const amt = (d?.amountFormatted ?? '').toString().trim();
    if (amt) return `Your ${amt} Radiantilyk Aesthetic gift card`;
    const ents = Array.isArray(d?.entitlements) ? d.entitlements : [];
    if (ents.length) return `Your Radiantilyk Aesthetic gift: ${ents.join(' · ')}`;
    return `Your Radiantilyk Aesthetic gift card`;
  },
  displayName: 'Voucher / gift card',
  previewData: {
    recipientName: 'Jane',
    code: 'GC-AB12CD34',
    amountFormatted: '$150.00',
    expiresOnFormatted: 'July 14, 2026',
    fromName: 'Radiantilyk Aesthetic',
    message: 'Enjoy a treat on us!',
  },
} satisfies TemplateEntry
