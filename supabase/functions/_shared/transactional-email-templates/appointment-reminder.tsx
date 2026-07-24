/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, button, card, container, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientFirstName?: string
  serviceName?: string
  providerName?: string
  appointmentTime?: string
  locationName?: string
  locationAddress?: string
  arrivalInstructions?: string
  hoursUntil?: number
  manageUrl?: string
}

const AppointmentReminderEmail = ({
  clientFirstName, serviceName, providerName, appointmentTime,
  locationName, locationAddress, arrivalInstructions, hoursUntil, manageUrl,
}: Props) => {
  const window = hoursUntil && hoursUntil >= 48
    ? "We're looking forward to seeing you in a few days."
    : "We're looking forward to seeing you tomorrow."
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reminder: your upcoming appointment at Radiantilyk Aesthetic</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brandMark}>Radiantilyk Aesthetic</Text>
            <Heading style={h1}>
              {clientFirstName ? `${clientFirstName}, a friendly reminder` : 'A friendly reminder'}
            </Heading>
            <Text style={text}>{window}</Text>
            {serviceName && <Text style={text}><strong>Service:</strong> {serviceName}</Text>}
            {appointmentTime && <Text style={text}><strong>When:</strong> {appointmentTime}</Text>}
            {providerName && <Text style={text}><strong>Provider:</strong> {providerName}</Text>}
            {(locationName || locationAddress) && (
              <Text style={text}>
                <strong>Where:</strong> {[locationName, locationAddress].filter(Boolean).join(' — ')}
              </Text>
            )}
            {arrivalInstructions && (
              <Text style={{ ...text, whiteSpace: 'pre-line' }}>
                <strong>Arrival instructions:</strong>{'\n'}{arrivalInstructions}
              </Text>
            )}
            <Text style={text}>
              Please arrive 5 minutes early. We require 48 hours notice to reschedule or cancel —
              missed appointments are subject to a $200 fee.
            </Text>
            {manageUrl && (
              <Section style={{ textAlign: 'center', marginTop: 24 }}>
                <Button href={manageUrl} style={button}>Manage appointment</Button>
              </Section>
            )}
          </Section>
          <Text style={footer}>Radiantilyk Aesthetic — San Jose &amp; San Mateo</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: AppointmentReminderEmail,
  subject: (d) => d.hoursUntil && d.hoursUntil <= 24
    ? 'Tomorrow: your appointment at Radiantilyk Aesthetic'
    : 'Upcoming: your appointment at Radiantilyk Aesthetic',
  displayName: 'Appointment reminder',
  previewData: {
    clientFirstName: 'Jane',
    serviceName: 'Botox',
    providerName: 'Kiem Vukadinovic',
    appointmentTime: 'Sat, Jul 11, 11:00 AM',
    locationName: 'San Jose Studio',
    locationAddress: '123 Main St, San Jose, CA',
    hoursUntil: 24,
    manageUrl: 'https://bookrka.com/booking/abc123',
  },
}
