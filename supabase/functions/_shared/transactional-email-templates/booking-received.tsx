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
  serviceName?: string
  requestedTime?: string
  providerName?: string
  locationAddress?: string
  arrivalInstructions?: string
}

const BookingReceivedEmail = ({ clientName, serviceName, requestedTime, providerName, locationAddress, arrivalInstructions }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We received your booking request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `Hi ${clientName},` : 'Hi there,'}</Heading>
          <Text style={text}>
            Thank you for requesting an appointment with Radiantilyk Aesthetic. We've received your
            request and our team will review it shortly.
          </Text>
          {serviceName && (
            <Text style={text}><strong>Service:</strong> {serviceName}</Text>
          )}
          {requestedTime && (
            <Text style={text}><strong>Requested time:</strong> {requestedTime}</Text>
          )}
          {providerName && (
            <Text style={text}><strong>Provider:</strong> {providerName}</Text>
          )}
          {locationAddress && (
            <Text style={text}><strong>Where:</strong> {locationAddress}</Text>
          )}
          {arrivalInstructions && (
            <Text style={{ ...text, whiteSpace: 'pre-line' }}>
              <strong>Arrival instructions:</strong>{'\n'}{arrivalInstructions}
            </Text>
          )}
          <Text style={text}>
            You'll receive a confirmation email as soon as your appointment is approved.
          </Text>
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · See you soon</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingReceivedEmail,
  subject: 'We received your booking request',
  displayName: 'Booking received',
  previewData: { clientName: 'Jane', serviceName: 'Neurotoxins', requestedTime: 'Mon, May 5 at 2:00 PM', providerName: 'Kamaren' },
} satisfies TemplateEntry
