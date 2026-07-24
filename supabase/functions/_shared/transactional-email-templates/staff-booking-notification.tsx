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
  reviewUrl?: string
}

const StaffBookingNotificationEmail = ({ staffName, clientName, clientEmail, clientPhone, serviceName, appointmentTime, locationName, reviewUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New booking request — log in to approve</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{staffName ? `${staffName}, new booking request` : 'New booking request'}</Heading>
          <Text style={text}>
            A client just requested an appointment. Please log in to the staff portal to approve or deny it.
          </Text>
          {clientName && (<Text style={text}><strong>Client:</strong> {clientName}</Text>)}
          {clientEmail && (<Text style={text}><strong>Email:</strong> {clientEmail}</Text>)}
          {clientPhone && (<Text style={text}><strong>Phone:</strong> {clientPhone}</Text>)}
          {serviceName && (<Text style={text}><strong>Service:</strong> {serviceName}</Text>)}
          {appointmentTime && (<Text style={text}><strong>Requested time:</strong> {appointmentTime}</Text>)}
          {locationName && (<Text style={text}><strong>Location:</strong> {locationName}</Text>)}
          {reviewUrl && (
            <Section style={{ textAlign: 'center', margin: '16px 0 24px' }}>
              <Button style={button} href={reviewUrl}>Review appointment</Button>
            </Section>
          )}
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic staff portal</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffBookingNotificationEmail,
  subject: 'New booking request — action needed',
  displayName: 'Staff booking notification',
  previewData: {
    staffName: 'Kamaren', clientName: 'Jane Doe', clientEmail: 'jane@example.com',
    clientPhone: '555-123-4567', serviceName: 'Neurotoxins',
    appointmentTime: 'Mon, May 12 at 2:00 PM', locationName: 'San Jose',
    reviewUrl: 'https://bookrka.com/staff/appointments/sample',
  },
} satisfies TemplateEntry
