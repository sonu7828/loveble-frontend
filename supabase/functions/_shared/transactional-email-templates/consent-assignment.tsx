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
}

const ConsentAssignmentEmail = ({ clientFirstName, signUrl, formList }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Please review and sign your consent forms</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Consent forms to sign</Heading>
        <Text style={text}>
          Hi {clientFirstName ?? 'there'}, your provider at {SITE_NAME} has shared the following
          consent forms for your upcoming appointment:
        </Text>
        {formList ? <Text style={list}>{formList}</Text> : null}
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={signUrl} style={button}>Review & sign</Button>
        </Section>
        <Text style={small}>
          Or paste this link into your browser:<br />
          <a href={signUrl} style={{ color: '#c97c5d' }}>{signUrl}</a>
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConsentAssignmentEmail,
  subject: 'Please review and sign your consent forms',
  displayName: 'Consent assignment',
  previewData: { clientFirstName: 'Jane', signUrl: 'https://bookrka.com/consents/abc', formList: '• Botox Consent\n• Photography Authorization' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'normal', color: '#2d2d2d', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const list = { fontSize: '14px', color: '#2d2d2d', lineHeight: '1.8', whiteSpace: 'pre-line' as const, margin: '0 0 16px', padding: '12px 16px', background: '#faf8f5', borderRadius: '8px' }
const button = { backgroundColor: '#c97c5d', color: '#ffffff', padding: '12px 28px', borderRadius: '999px', fontSize: '14px', textDecoration: 'none' }
const small = { fontSize: '12px', color: '#999', lineHeight: '1.5', margin: '24px 0 0' }
const footer = { fontSize: '12px', color: '#999', margin: '32px 0 0' }
