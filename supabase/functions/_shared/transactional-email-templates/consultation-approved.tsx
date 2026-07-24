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
  appointmentTime?: string
  providerName?: string
  locationAddress?: string
}

const ConsultationApprovedEmail = ({ clientName, appointmentTime, providerName, locationAddress }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your complimentary consultation is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `${clientName}, your consultation is confirmed` : 'Your consultation is confirmed'}</Heading>
          <Text style={text}>
            We're excited to meet you. Your complimentary 30-minute consultation
            with Radiantilyk Aesthetic has been approved.
          </Text>
          {appointmentTime && (<Text style={text}><strong>When:</strong> {appointmentTime}</Text>)}
          {providerName && (<Text style={text}><strong>With:</strong> {providerName}</Text>)}
          {locationAddress && (<Text style={text}><strong>Where:</strong> {locationAddress}</Text>)}
          <Text style={text}>
            During your consultation, we'll discuss your goals, walk through treatment
            options, and answer any questions you have. There's no obligation — just an
            opportunity to learn what's possible. Please arrive 5 minutes early.
          </Text>
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · Looking forward to your visit</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConsultationApprovedEmail,
  subject: 'Your complimentary consultation is confirmed',
  displayName: 'Consultation approved',
  previewData: { clientName: 'Jane', appointmentTime: 'Mon, May 5 at 2:00 PM', providerName: 'Kamaren' },
} satisfies TemplateEntry
