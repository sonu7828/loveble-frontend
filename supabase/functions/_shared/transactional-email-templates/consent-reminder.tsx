import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Radiantilyk Aesthetic"

interface Props {
  clientFirstName?: string
  signUrl: string
  formList?: string
  appointmentTime?: string
  hoursUntil?: number
}

const ConsentReminderEmail = ({ clientFirstName, signUrl, formList, appointmentTime, hoursUntil }: Props) => {
  const urgency = hoursUntil && hoursUntil <= 24
    ? 'Your appointment is tomorrow — please sign before you arrive.'
    : 'Your appointment is in 2 days — please sign at your earliest convenience.'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reminder: please sign your consent forms</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Friendly reminder</Heading>
          <Text style={text}>
            Hi {clientFirstName ?? 'there'}, we noticed the consent form(s) for your upcoming
            {appointmentTime ? ` appointment on ${appointmentTime}` : ' appointment'} at {SITE_NAME} haven't been signed yet.
          </Text>
          <Text style={text}><strong>{urgency}</strong></Text>
          {formList ? <Text style={list}>{formList}</Text> : null}
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={signUrl} style={button}>Review & sign</Button>
          </Section>
          <Text style={small}>
            Or paste this link into your browser:<br />
            <a href={signUrl} style={{ color: '#c97c5d' }}>{signUrl}</a>
          </Text>
          <Text style={small}>
            Signing in advance helps us start on time and gives you a calm, unhurried visit.
          </Text>
          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ConsentReminderEmail,
  subject: (d: Record<string, any>) =>
    (d?.hoursUntil && d.hoursUntil <= 24)
      ? 'Reminder: sign your consent forms before tomorrow'
      : 'Reminder: please sign your consent forms',
  displayName: 'Consent reminder',
  previewData: { clientFirstName: 'Jane', signUrl: 'https://bookrka.com/consents/abc', formList: '• Botox Consent', appointmentTime: 'Fri, May 22, 10:00 AM', hoursUntil: 24 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'normal', color: '#2d2d2d', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const list = { fontSize: '14px', color: '#2d2d2d', lineHeight: '1.8', whiteSpace: 'pre-line' as const, margin: '0 0 16px', padding: '12px 16px', background: '#faf8f5', borderRadius: '8px' }
const button = { backgroundColor: '#c97c5d', color: '#ffffff', padding: '12px 28px', borderRadius: '999px', fontSize: '14px', textDecoration: 'none' }
const small = { fontSize: '12px', color: '#999', lineHeight: '1.5', margin: '24px 0 0' }
const footer = { fontSize: '12px', color: '#999', margin: '32px 0 0' }
