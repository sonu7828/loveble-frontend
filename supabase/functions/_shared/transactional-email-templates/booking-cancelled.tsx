/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, button, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  serviceName?: string
  appointmentTime?: string
  providerName?: string
  locationName?: string
  lateCancel?: boolean
  rebookUrl?: string
  reason?: string
}

const BookingCancelledEmail = ({
  clientName, serviceName, appointmentTime, providerName, locationName, lateCancel, rebookUrl, reason,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your appointment has been cancelled</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `${clientName}, your appointment was cancelled` : 'Your appointment was cancelled'}</Heading>
          <Text style={text}>
            We've cancelled the appointment below. We hope to see you again soon.
          </Text>
          {serviceName && (<Text style={text}><strong>Service:</strong> {serviceName}</Text>)}
          {appointmentTime && (<Text style={text}><strong>When:</strong> {appointmentTime}</Text>)}
          {providerName && (<Text style={text}><strong>Provider:</strong> {providerName}</Text>)}
          {locationName && (<Text style={text}><strong>Where:</strong> {locationName}</Text>)}
          {reason && (<Text style={text}><strong>Reason:</strong> {reason}</Text>)}
          {lateCancel && (
            <Text style={text}>
              Because this cancellation was within 48 hours of the appointment, a $200 late-cancel fee may be applied to your card on file per our policy.
            </Text>
          )}
          {rebookUrl && (
            <Section style={{ margin: '8px 0 24px' }}>
              <Button href={rebookUrl} style={button}>Book a new appointment</Button>
            </Section>
          )}
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingCancelledEmail,
  subject: 'Your Radiantilyk Aesthetic appointment was cancelled',
  displayName: 'Booking cancelled (client)',
  previewData: { clientName: 'Jane', serviceName: 'Neurotoxins', appointmentTime: 'Mon, May 5 at 2:00 PM', providerName: 'Kamaren', locationName: 'San Jose Studio', rebookUrl: 'https://bookrka.com/book' },
} satisfies TemplateEntry
