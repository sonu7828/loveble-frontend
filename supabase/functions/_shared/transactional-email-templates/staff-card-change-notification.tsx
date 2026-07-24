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
  action?: 'added' | 'removed'
  clientEmail?: string
  clientName?: string
  cardBrand?: string
  cardLast4?: string
  cardholderName?: string
  cardExpMonth?: number | string
  cardExpYear?: number | string
  staffEmail?: string
  occurredAt?: string
}

const StaffCardChangeEmail = ({
  action = 'added',
  clientEmail = '',
  clientName = '',
  cardBrand = '',
  cardLast4 = '',
  cardholderName = '',
  cardExpMonth = '',
  cardExpYear = '',
  staffEmail = '',
  occurredAt = '',
}: Props) => {
  const verb = action === 'removed' ? 'removed from' : 'added to'
  const title = action === 'removed' ? 'Card removed from client profile' : 'Card added to client profile'
  const brand = (cardBrand || 'Card').toString().toUpperCase()
  const last4 = cardLast4 || '????'
  const exp = `${String(cardExpMonth || '?').padStart(2, '0')}/${String(cardExpYear || '??').toString().slice(-2)}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${brand} •••• ${last4} ${verb} ${clientEmail}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brandMark}>Radiantilyk Aesthetic</Text>
            <Heading style={h1}>{title}</Heading>
            <Text style={text}>
              A card on file was <strong>{action}</strong> for <strong>{clientName || clientEmail}</strong>.
            </Text>
            <Text style={{ ...text, margin: '12px 0 4px' }}><strong>Client</strong></Text>
            <Text style={{ ...text, margin: '0 0 12px' }}>
              {clientName ? `${clientName} · ` : ''}{clientEmail}
            </Text>
            <Text style={{ ...text, margin: '12px 0 4px' }}><strong>Card</strong></Text>
            <Text style={{ ...text, margin: '0 0 12px' }}>
              {brand} •••• {last4}{cardholderName ? ` · ${cardholderName}` : ''} · Exp {exp}
            </Text>
            <Text style={{ ...text, margin: '12px 0 4px' }}><strong>Action by</strong></Text>
            <Text style={{ ...text, margin: '0 0 12px' }}>
              {staffEmail || 'Staff'}{occurredAt ? ` · ${occurredAt}` : ''}
            </Text>
            <Section style={divider} />
            <Text style={footer}>
              <strong>Radiantilyk Aesthetic</strong><br />
              San Jose Studio · 2100 Curtner Ave, Ste 1B, San Jose, CA 95124<br />
              San Mateo Studio · 1528 S El Camino Real, #200, San Mateo, CA 94402<br />
              408-351-1873
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: StaffCardChangeEmail,
  subject: (d: Record<string, any>) => {
    const verb = d?.action === 'removed' ? 'removed' : 'added'
    const brand = (d?.cardBrand || 'Card').toString().toUpperCase()
    const last4 = d?.cardLast4 || '????'
    return `[Card ${verb}] ${brand} •••• ${last4} — ${d?.clientEmail ?? ''}`
  },
  displayName: 'Staff: client card added/removed',
  previewData: {
    action: 'added',
    clientEmail: 'jane@example.com',
    clientName: 'Jane Doe',
    cardBrand: 'visa',
    cardLast4: '4242',
    cardholderName: 'Jane Doe',
    cardExpMonth: 12,
    cardExpYear: 2028,
    staffEmail: 'staff@rkaglow.com',
    occurredAt: 'May 19, 2026 9:00 AM PT',
  },
} satisfies TemplateEntry
