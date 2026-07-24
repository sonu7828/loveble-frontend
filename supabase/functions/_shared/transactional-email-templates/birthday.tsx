/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, button, card, container, divider, footer, h1, link, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientFirstName?: string
  rebookUrl?: string
}

const BirthdayEmail = ({
  clientFirstName = 'there',
  rebookUrl = 'https://bookrka.com/book',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Happy birthday from Radiantilyk Aesthetic ✨`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>Happy birthday, {clientFirstName}.</Heading>
          <Text style={text}>
            Wishing you a year of glow, joy, and beautiful skin. Thank you for being part of our RKA family.
          </Text>
          <Text style={text}>
            As our gift, your next visit comes with a little birthday treat from your provider — just mention this email when you arrive.
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
            <Button style={button} href={rebookUrl}>Book your birthday visit</Button>
          </Section>
          <Text style={{ ...text, fontSize: '12px', textAlign: 'center', color: '#7a716c', margin: '12px 0 0' }}>
            Or <a href={rebookUrl} style={link}>browse our menu</a>.
          </Text>

          <Section style={divider} />
          <Text style={footer}>
            Radiantilyk Aesthetic · San Jose & San Mateo<br />
            With love, your RKA team
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BirthdayEmail,
  subject: 'Happy birthday from Radiantilyk Aesthetic ✨',
  displayName: 'Birthday greeting',
  previewData: {
    clientFirstName: 'Jane',
    rebookUrl: 'https://bookrka.com/book',
  },
} satisfies TemplateEntry
