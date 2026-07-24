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
  reason?: string
}

const BookingDeniedEmail = ({ clientName, serviceName, requestedTime, reason }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An update on your booking request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `Hi ${clientName},` : 'Hi there,'}</Heading>
          <Text style={text}>
            Thank you for your interest in booking with Radiantilyk Aesthetic. Unfortunately, we
            aren't able to accommodate your requested appointment at this time.
          </Text>
          {serviceName && (<Text style={text}><strong>Service:</strong> {serviceName}</Text>)}
          {requestedTime && (<Text style={text}><strong>Requested time:</strong> {requestedTime}</Text>)}
          {reason && (<Text style={text}><strong>Note from our team:</strong> {reason}</Text>)}
          <Text style={text}>
            We'd love to find another time that works. Please visit our booking page
            to choose a different slot.
          </Text>
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingDeniedEmail,
  subject: 'An update on your booking request',
  displayName: 'Booking denied',
  previewData: { clientName: 'Jane', serviceName: 'Neurotoxins', requestedTime: 'Mon, May 5 at 2:00 PM' },
} satisfies TemplateEntry
