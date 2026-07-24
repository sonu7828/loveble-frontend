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
  clientName?: string
  requestedTime?: string
  reason?: string
}

const ConsultationDeniedEmail = ({ clientName, requestedTime, reason }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An update on your consultation request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `Hi ${clientName},` : 'Hi there,'}</Heading>
          <Text style={text}>
            Thank you for requesting a complimentary consultation with Radiantilyk Aesthetic.
            Unfortunately, we aren't able to accommodate the time you requested.
          </Text>
          {requestedTime && (<Text style={text}><strong>Requested time:</strong> {requestedTime}</Text>)}
          {reason && (<Text style={text}><strong>Note from our team:</strong> {reason}</Text>)}
          <Text style={text}>
            We'd still love to connect. Please visit our booking page to choose another
            time that works for you — your consultation is on us.
          </Text>
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConsultationDeniedEmail,
  subject: 'An update on your consultation request',
  displayName: 'Consultation denied',
  previewData: { clientName: 'Jane', requestedTime: 'Mon, May 5 at 2:00 PM' },
} satisfies TemplateEntry
