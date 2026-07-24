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
  staffName?: string
  method?: 'REQUEST' | 'CANCEL'
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  serviceName?: string
  appointmentTime?: string
  locationName?: string
  icsUrl?: string
}

const StaffCalendarUpdateEmail = ({ staffName, method, clientName, clientPhone, clientEmail, serviceName, appointmentTime, locationName, icsUrl }: Props) => {
  const isCancel = method === 'CANCEL'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{isCancel ? 'Appointment cancelled' : 'Appointment on your calendar'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brandMark}>Radiantilyk Aesthetic</Text>
            <Heading style={h1}>
              {isCancel
                ? (staffName ? `${staffName}, appointment cancelled` : 'Appointment cancelled')
                : (staffName ? `${staffName}, calendar updated` : 'Calendar updated')}
            </Heading>
            <Text style={text}>
              {isCancel
                ? 'The following appointment has been removed from your schedule. Please open the attached calendar file to remove it from your personal calendar.'
                : 'The following appointment is on your schedule. Open the attached calendar file to add or update it on your personal calendar.'}
            </Text>
            {clientName && (<Text style={text}><strong>Client:</strong> {clientName}</Text>)}
            {serviceName && (<Text style={text}><strong>Service:</strong> {serviceName}</Text>)}
            {appointmentTime && (<Text style={text}><strong>Time:</strong> {appointmentTime}</Text>)}
            {locationName && (<Text style={text}><strong>Location:</strong> {locationName}</Text>)}
            {clientPhone && (<Text style={text}><strong>Phone:</strong> {clientPhone}</Text>)}
            {clientEmail && (<Text style={text}><strong>Email:</strong> {clientEmail}</Text>)}
            {icsUrl && (
              <Section style={{ textAlign: 'center', margin: '16px 0 24px' }}>
                <Button style={button} href={icsUrl}>{isCancel ? 'Open cancellation file' : 'Add to calendar'}</Button>
              </Section>
            )}
            <Section style={divider} />
            <Text style={footer}>This is an automatic update from the Radiantilyk Aesthetic booking system.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: StaffCalendarUpdateEmail,
  subject: (d: Record<string, any>) =>
    d?.method === 'CANCEL'
      ? `Cancelled: ${d?.serviceName ?? 'appointment'} — ${d?.clientName ?? ''}`.trim()
      : `Calendar update: ${d?.serviceName ?? 'appointment'} — ${d?.clientName ?? ''}`.trim(),
  displayName: 'Staff calendar update',
  previewData: {
    staffName: 'Kamaren', method: 'REQUEST', clientName: 'Jane Doe',
    clientPhone: '555-123-4567', clientEmail: 'jane@example.com',
    serviceName: 'Botox Full Face', appointmentTime: 'Mon, May 12 at 2:00 PM',
    locationName: 'San Jose', icsUrl: 'https://example.com/invite.ics',
  },
} satisfies TemplateEntry
