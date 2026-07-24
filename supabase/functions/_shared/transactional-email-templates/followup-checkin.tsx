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
  day?: 2 | 14
  providerFirstName?: string
  feedbackUrl?: string
  rebookUrl?: string
}

const COPY: Record<number, { heading: string; body: string; cta: string }> = {
  2: {
    heading: 'How are you feeling?',
    body: "It's been a couple of days since your visit. Most clients are well past any soreness, redness, or swelling by now — but if anything's unexpected, we want to know. Tap below to send your provider a quick note or upload a photo.",
    cta: 'Send an update',
  },
  14: {
    heading: 'Two weeks in — how does it look?',
    body: "Around this point your results should be settling in beautifully. We'd love to hear how you're feeling about your treatment, and if it's time to plan your next visit we're here when you are.",
    cta: 'Share feedback',
  },
}

const Email = ({
  clientFirstName = 'there',
  serviceName = 'your treatment',
  day = 2,
  providerFirstName = '',
  feedbackUrl = 'https://bookrka.com',
  rebookUrl = 'https://bookrka.com/book',
}: Props) => {
  const copy = COPY[day] ?? COPY[2]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Day ${day} check-in for ${serviceName}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brandMark}>Radiantilyk Aesthetic</Text>
            <Heading style={h1}>{copy.heading}</Heading>
            <Text style={text}>
              Hi {clientFirstName}{providerFirstName ? `, it's ${providerFirstName}` : ''}. {copy.body}
            </Text>
            <Section style={{ textAlign: 'center', margin: '28px 0 12px' }}>
              <Button href={feedbackUrl} style={{ ...button, padding: '14px 28px' }}>
                {copy.cta}
              </Button>
            </Section>
            {day === 14 && (
              <Text style={{ ...text, textAlign: 'center' as const, fontSize: '13px' }}>
                Ready to book your next visit? <a href={rebookUrl} style={{ color: '#c96a4d' }}>Schedule here</a>.
              </Text>
            )}
          </Section>
          <Text style={footer}>Radiantilyk Aesthetic · San Jose & San Mateo</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: ({ day }: { day?: number }) => day === 14 ? 'Two weeks in — how does it look?' : 'Quick check-in from your provider',
  displayName: 'Day 2 / 14 follow-up',
  previewData: {
    clientFirstName: 'Jane',
    serviceName: 'Neurotoxins',
    day: 2,
    providerFirstName: 'Kamaren',
    feedbackUrl: 'https://bookrka.com/feedback/sample',
    rebookUrl: 'https://bookrka.com/book',
  },
} satisfies TemplateEntry
