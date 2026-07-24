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
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  serviceName?: string
  appointmentTime?: string
  locationName?: string
  cancelledBy?: string
  reason?: string
  lateCancel?: boolean
  reviewUrl?: string
}

const StaffCancellationEmail = ({
  staffName, clientName, clientEmail, clientPhone, serviceName, appointmentTime,
  locationName, cancelledBy, reason, lateCancel, reviewUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Appointment cancelled — {clientName ?? 'a client'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>Appointment cancelled{lateCancel ? ' (late)' : ''}</Heading>
          <Text style={text}>
            Hi {staffName ?? 'team'} — an appointment has been cancelled{cancelledBy ? ` by ${cancelledBy}` : ''}.
          </Text>
          {clientName && (<Text style={text}><strong>Client:</strong> {clientName}</Text>)}
          {clientEmail && (<Text style={text}><strong>Email:</strong> {clientEmail}</Text>)}
          {clientPhone && (<Text style={text}><strong>Phone:</strong> {clientPhone}</Text>)}
          {serviceName && (<Text style={text}><strong>Service:</strong> {serviceName}</Text>)}
          {appointmentTime && (<Text style={text}><strong>When:</strong> {appointmentTime}</Text>)}
          {locationName && (<Text style={text}><strong>Where:</strong> {locationName}</Text>)}
          {reason && (<Text style={text}><strong>Reason:</strong> {reason}</Text>)}
          {lateCancel && (
            <Text style={text}>
              This cancellation is within 48 hours — a $200 late-cancel fee can be charged from the appointment page.
            </Text>
          )}
          {reviewUrl && (
            <Section style={{ margin: '8px 0 24px' }}>
              <Button href={reviewUrl} style={button}>Open appointment</Button>
            </Section>
          )}
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · Staff notification</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffCancellationEmail,
  subject: ({ clientName, lateCancel }: any) =>
    `${lateCancel ? '[Late cancel] ' : ''}Cancellation — ${clientName ?? 'client'}`,
  displayName: 'Staff cancellation notification',
  previewData: {
    staffName: 'Kiem', clientName: 'Jane Doe', clientEmail: 'jane@example.com', clientPhone: '408-555-1212',
    serviceName: 'Neurotoxins', appointmentTime: 'Mon, May 5 · 2:00 PM',
    locationName: 'San Jose Studio', cancelledBy: 'the client', lateCancel: true,
    reviewUrl: 'https://bookrka.com/staff/appointments/sample',
  },
} satisfies TemplateEntry
