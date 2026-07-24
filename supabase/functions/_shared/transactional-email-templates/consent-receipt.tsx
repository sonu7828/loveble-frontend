/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  serviceName?: string
  pdfUrl?: string
}

const ConsentReceiptEmail = ({ clientName, serviceName, pdfUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your signed consent forms — Radiantilyk Aesthetic</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `Hi ${clientName},` : 'Hi there,'}</Heading>
          <Text style={text}>
            Thank you for completing the consent forms for your {serviceName ? <strong>{serviceName}</strong> : 'appointment'}.
            A copy of your signed paperwork is attached below for your records.
          </Text>
          {pdfUrl ? (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button
                href={pdfUrl}
                style={{
                  background: '#c97c5d',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '12px 28px',
                  fontSize: '14px',
                  textDecoration: 'none',
                }}
              >
                View your signed consents (PDF)
              </Button>
            </Section>
          ) : (
            <Text style={text}>
              Your signed consents are stored securely in your patient record. If you'd like a copy,
              just reply to this email.
            </Text>
          )}
          <Text style={text}>
            Please keep this email for your records. You may revoke any optional authorization
            (e.g. marketing) at any time by emailing radiantilyk@gmail.com.
          </Text>
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · See you soon</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConsentReceiptEmail,
  subject: 'Your signed consent forms',
  displayName: 'Consent receipt',
  previewData: {
    clientName: 'Jane',
    serviceName: 'Neurotoxins',
    pdfUrl: 'https://example.com/consents.pdf',
  },
} satisfies TemplateEntry
