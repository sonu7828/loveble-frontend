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
  staffName?: string
  activationUrl?: string
}

const StaffActivationEmail = ({ staffName, activationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Activate your Radiantilyk Aesthetic staff account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{staffName ? `Welcome, ${staffName}` : 'Welcome to Radiantilyk Aesthetic'}</Heading>
          <Text style={text}>
            You've been invited to the Radiantilyk Aesthetic team portal. Click the button below to
            activate your account, set your password, and connect your Google Calendar
            so approved appointments sync automatically.
          </Text>
          {activationUrl && (
            <Section style={{ textAlign: 'center', margin: '12px 0 24px' }}>
              <Button style={button} href={activationUrl}>Activate account</Button>
            </Section>
          )}
          {activationUrl && (
            <Text style={{ ...text, fontSize: '13px' }}>
              Or paste this link into your browser:<br />
              <Link href={activationUrl} style={link}>{activationUrl}</Link>
            </Text>
          )}
          <Section style={divider} />
          <Text style={footer}>This link expires in 7 days. If you weren't expecting this, you can ignore this email.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffActivationEmail,
  subject: 'Activate your Radiantilyk Aesthetic staff account',
  displayName: 'Staff activation',
  previewData: { staffName: 'Kamaren', activationUrl: 'https://bookrka.com/staff/activate/sample-token' },
} satisfies TemplateEntry
