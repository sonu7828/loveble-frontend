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
  serviceName?: string
  providerName?: string
  locationName?: string
  reviewUrl?: string
  rebookUrl?: string
  feedbackUrl?: string
  discountSummary?: string
  discountReason?: string
  discountAmount?: string
}

const PostVisitReviewEmail = ({
  clientFirstName = 'there',
  serviceName = 'your treatment',
  providerName,
  locationName,
  reviewUrl,
  rebookUrl = 'https://bookrka.com/book',
  feedbackUrl,
  discountSummary,
  discountReason,
  discountAmount,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Thank you for visiting Radiantilyk Aesthetic — share a quick review?`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>Thank you, {clientFirstName}.</Heading>
          <Text style={text}>
            It was a pleasure seeing you{providerName ? ` — ${providerName} loved having you in the chair` : ''}
            {locationName ? ` at our ${locationName} studio` : ''}. We hope you're loving the results of your {serviceName}.
          </Text>

          {discountSummary && (
            <Section style={{ margin: '8px 0 18px', padding: '12px 14px', borderRadius: 10, backgroundColor: '#f7f1ea', border: '1px solid #ecd9c5' }}>
              <Text style={{ ...text, margin: 0, fontSize: '13px', color: '#6b4a26', fontWeight: 600 }}>
                Discount applied{discountAmount ? `: ${discountAmount}` : ''}
              </Text>
              <Text style={{ ...text, margin: '4px 0 0', fontSize: '12px', color: '#7a6a55' }}>
                {discountSummary}
              </Text>
              {discountReason && !discountSummary.includes(discountReason) && (
                <Text style={{ ...text, margin: '4px 0 0', fontSize: '12px', color: '#7a6a55' }}>
                  Reason: {discountReason}
                </Text>
              )}
            </Section>
          )}

          <Text style={text}>
            If you have a moment, a quick Google review means the world to a small studio like ours and helps other guests find us.
          </Text>

          <Section style={{ margin: '8px 0 18px', padding: '14px 16px', borderRadius: 12, backgroundColor: '#f7f1ea', border: '1px solid #ecd9c5', textAlign: 'center' as const }}>
            <Text style={{ ...text, margin: 0, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8a6a3a', fontWeight: 600 }}>
              Our thank-you to you
            </Text>
            <Text style={{ ...text, margin: '6px 0 0', fontSize: '18px', color: '#3a2a14', fontWeight: 700 }}>
              Leave a review &amp; get $100 off your next service
            </Text>
            <Text style={{ ...text, margin: '6px 0 0', fontSize: '12px', color: '#7a6a55' }}>
              Show us your published Google review at your next visit and we'll apply $100 off any service of $300 or more. One per guest.
            </Text>
          </Section>

          {reviewUrl && (
            <Section style={{ textAlign: 'center', margin: '4px 0 28px' }}>
              <Button style={button} href={reviewUrl}>Leave a Google review</Button>
              <Text style={{ ...text, fontSize: '12px', margin: '14px 0 0', color: '#7a716c' }}>
                Takes about 30 seconds — thank you!
              </Text>
            </Section>
          )}

          {feedbackUrl && (
            <Text style={{ ...text, fontSize: '13px', textAlign: 'center', color: '#7a716c', margin: '0 0 8px' }}>
              Prefer to share privately? <a href={feedbackUrl} style={link}>Send us feedback directly →</a>
            </Text>
          )}

          <Section style={divider} />

          <Heading as="h2" style={{ ...h1, fontSize: '20px', margin: '8px 0 12px' }}>Ready to plan your next visit?</Heading>
          <Text style={text}>
            We've prefilled your {serviceName}{providerName ? ` with ${providerName}` : ''} — just pick a time that works.
          </Text>
          <Section style={{ textAlign: 'center', margin: '16px 0 8px' }}>
            <Button style={{ ...button, backgroundColor: '#252220' }} href={rebookUrl}>Rebook in one tap</Button>
          </Section>
          <Text style={{ ...text, fontSize: '12px', textAlign: 'center', color: '#7a716c', margin: '8px 0 0' }}>
            Or <a href={rebookUrl} style={link}>open the booking page</a> to choose a different service.
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
  component: PostVisitReviewEmail,
  subject: 'Thank you for visiting Radiantilyk Aesthetic',
  displayName: 'Post-visit review request',
  previewData: {
    clientFirstName: 'Jane',
    serviceName: 'Neurotoxins',
    providerName: 'Kamaren',
    locationName: 'San Jose',
    reviewUrl: 'https://g.page/r/example/review',
    rebookUrl: 'https://bookrka.com/book',
    feedbackUrl: 'https://bookrka.com/feedback/example-token',
  },
} satisfies TemplateEntry
