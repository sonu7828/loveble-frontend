/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, card, container, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  serviceName?: string
  staffName?: string
  locationName?: string
  windowLabel?: string
  notes?: string
}

const WaitlistNotificationEmail = ({ clientName, clientEmail, clientPhone, serviceName, staffName, locationName, windowLabel, notes }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New waitlist request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>New waitlist request</Heading>
          <Text style={text}>A client just joined the waitlist. They’ll be notified automatically when a matching slot opens.</Text>
          {clientName && (<Text style={text}><strong>Client:</strong> {clientName}</Text>)}
          {clientEmail && (<Text style={text}><strong>Email:</strong> {clientEmail}</Text>)}
          {clientPhone && (<Text style={text}><strong>Phone:</strong> {clientPhone}</Text>)}
          {serviceName && (<Text style={text}><strong>Service:</strong> {serviceName}</Text>)}
          {staffName && (<Text style={text}><strong>Provider preference:</strong> {staffName}</Text>)}
          {locationName && (<Text style={text}><strong>Location preference:</strong> {locationName}</Text>)}
          {windowLabel && (<Text style={text}><strong>Window:</strong> {windowLabel}</Text>)}
          {notes && (<Text style={text}><strong>Notes:</strong> {notes}</Text>)}
          <Text style={footer}>You can review and manually offer a slot from the staff portal.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WaitlistNotificationEmail,
  subject: 'New waitlist request',
  displayName: 'Waitlist notification (staff)',
  previewData: { clientName: 'Jane Doe', clientEmail: 'jane@example.com', clientPhone: '555-1234', serviceName: 'Botox', windowLabel: 'Weekday afternoons, next 2 weeks' },
} satisfies TemplateEntry
