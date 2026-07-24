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
  activationUrl?: string
}

const ClientActivationEmail = ({ clientName, activationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Create your Radiantilyk Aesthetic account to rebook faster</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{clientName ? `${clientName}, create your account` : 'Create your Radiantilyk Aesthetic account'}</Heading>
          <Text style={text}>
            Thanks for being a Radiantilyk Aesthetic client. Activate an account to view your past
            and upcoming appointments, rebook with your info prefilled, and access your
            signed consent forms — all in one place.
          </Text>
          {activationUrl && (
            <Section style={{ textAlign: 'center', margin: '12px 0 24px' }}>
              <Button style={button} href={activationUrl}>Create account</Button>
            </Section>
          )}
          {activationUrl && (
            <Text style={{ ...text, fontSize: '13px' }}>
              Or paste this link into your browser:<br />
              <Link href={activationUrl} style={link}>{activationUrl}</Link>
            </Text>
          )}
          <Section style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · See you soon</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientActivationEmail,
  subject: 'Create your Radiantilyk Aesthetic account',
  displayName: 'Client activation',
  previewData: { clientName: 'Jane', activationUrl: 'https://bookrka.com/client/auth?email=jane@example.com' },
} satisfies TemplateEntry
