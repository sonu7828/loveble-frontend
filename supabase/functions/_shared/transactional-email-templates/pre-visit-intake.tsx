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
  appointmentTime?: string
  intakeUrl?: string
}

const Email = ({
  clientFirstName = 'there',
  serviceName = 'your treatment',
  appointmentTime = 'your upcoming visit',
  intakeUrl = 'https://bookrka.com',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`A quick intake form before ${appointmentTime}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>A quick intake before we see you</Heading>
          <Text style={text}>
            Hi {clientFirstName}, you're booked for <strong>{serviceName}</strong> on {appointmentTime}. To make your visit as smooth and safe as possible, please take 2 minutes to fill out a short intake form before you arrive.
          </Text>
          <Text style={text}>
            It covers allergies, current medications, recent treatments, and what you're hoping to get from this visit — all the info your provider needs to personalize your care.
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0 12px' }}>
            <Button href={intakeUrl} style={{ ...button, padding: '14px 28px' }}>
              Complete intake
            </Button>
          </Section>
          <Text style={{ ...text, fontSize: '12px', color: '#7a716c', textAlign: 'center' as const }}>
            Your responses are private and go directly to your clinical chart.
          </Text>
        </Section>
        <Text style={footer}>Radiantilyk Aesthetic · San Jose & San Mateo</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Quick intake before your visit',
  displayName: 'Pre-visit intake',
  previewData: {
    clientFirstName: 'Jane',
    serviceName: 'Neurotoxins',
    appointmentTime: 'Mon, Jun 10 at 2:00 PM',
    intakeUrl: 'https://bookrka.com/intake/sample',
  },
} satisfies TemplateEntry
