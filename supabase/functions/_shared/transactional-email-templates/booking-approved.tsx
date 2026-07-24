/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, button, card, container, divider, footer, h1, link, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  serviceName?: string
  appointmentTime?: string
  providerName?: string
  locationAddress?: string
  arrivalInstructions?: string
  googleCalendarUrl?: string
  icsUrl?: string
  manageUrl?: string
}

const BookingApprovedEmail = ({ clientName, serviceName, appointmentTime, providerName, locationAddress, arrivalInstructions, googleCalendarUrl, icsUrl, manageUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your appointment is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `${clientName}, you're confirmed` : "You're confirmed"}</Heading>
          <Text style={text}>
            Great news — your appointment with Radiantilyk Aesthetic has been approved.
          </Text>
          {serviceName && (<Text style={text}><strong>Service:</strong> {serviceName}</Text>)}
          {appointmentTime && (<Text style={text}><strong>When:</strong> {appointmentTime}</Text>)}
          {providerName && (<Text style={text}><strong>Provider:</strong> {providerName}</Text>)}
          {locationAddress && (<Text style={text}><strong>Where:</strong> {locationAddress}</Text>)}
          {arrivalInstructions && (
            <Text style={{ ...text, whiteSpace: 'pre-line' }}>
              <strong>Arrival instructions:</strong>{'\n'}{arrivalInstructions}
            </Text>
          )}
          <Text style={text}>
            Please arrive 5 minutes early. We require 48 hours notice to reschedule or cancel.
          </Text>
          {manageUrl && (
            <Section style={{ margin: '8px 0 24px' }}>
              <Button href={manageUrl} style={button}>Manage your appointment</Button>
              <Text style={{ ...text, fontSize: 12, margin: '12px 0 0', color: '#7a716c' }}>
                Reschedule or cancel anytime — no login required.
              </Text>
            </Section>
          )}
          {(googleCalendarUrl || icsUrl) && (
            <Section style={{ margin: '8px 0 24px' }}>
              {googleCalendarUrl && (
                <Button href={googleCalendarUrl} style={{ ...button, marginRight: 12 }}>Add to Google Calendar</Button>
              )}
              {icsUrl && (
                <Text style={{ ...text, margin: '12px 0 0' }}>
                  Apple / Outlook: <Link href={icsUrl} style={link}>Download calendar invite (.ics)</Link>
                </Text>
              )}
            </Section>
          )}
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · Can't wait to see you</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingApprovedEmail,
  subject: 'Your Radiantilyk Aesthetic appointment is confirmed',
  displayName: 'Booking approved',
  previewData: { clientName: 'Jane', serviceName: 'Neurotoxins', appointmentTime: 'Mon, May 5 at 2:00 PM', providerName: 'Kamaren', manageUrl: 'https://bookrka.com/booking/sample' },
} satisfies TemplateEntry
