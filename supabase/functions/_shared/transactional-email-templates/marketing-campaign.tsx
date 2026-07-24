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
  subjectLine?: string
  previewText?: string
  bodyMarkdown?: string
  ctaLabel?: string
  ctaUrl?: string
  signOff?: string
}

// Tiny safe-ish markdown: paragraphs split on blank line, supports
// **bold**, *italic*, [text](url), and bullet lists with leading "- ".
function renderMarkdown(md: string) {
  const blocks = md.replace(/\r\n/g, '\n').split(/\n{2,}/).filter(Boolean)
  return blocks.map((raw, bi) => {
    const lines = raw.split('\n')
    const isList = lines.every(l => /^\s*[-*]\s+/.test(l))
    if (isList) {
      return (
        <ul key={bi} style={{ ...text, paddingLeft: '20px', margin: '0 0 12px' } as any}>
          {lines.map((l, li) => (
            <li key={li} style={{ marginBottom: '6px' } as any}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>
          ))}
        </ul>
      )
    }
    return <Text key={bi} style={text}>{inline(raw)}</Text>
  })
}

function inline(s: string): React.ReactNode {
  // Process [text](url), then **bold**, then *italic*
  const out: React.ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0; let m: RegExpExecArray | null; let key = 0
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index))
    if (m[1] && m[2]) out.push(<a key={key++} href={m[2]} style={link}>{m[1]}</a>)
    else if (m[3]) out.push(<strong key={key++}>{m[3]}</strong>)
    else if (m[4]) out.push(<em key={key++}>{m[4]}</em>)
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

const MarketingCampaignEmail = ({
  clientFirstName = 'there',
  subjectLine,
  previewText,
  bodyMarkdown = '',
  ctaLabel,
  ctaUrl,
  signOff = 'With love, your RKA team',
}: Props) => {
  const greeted = bodyMarkdown.replace(/\{\{\s*first_name\s*\}\}/gi, clientFirstName)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{previewText || subjectLine || 'A note from Radiantilyk Aesthetic'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brandMark}>Radiantilyk Aesthetic</Text>
            {subjectLine && <Heading style={h1}>{subjectLine}</Heading>}
            <Text style={{ ...text, marginTop: subjectLine ? '0' : undefined }}>Hi {clientFirstName},</Text>
            {renderMarkdown(greeted)}
            {ctaUrl && (
              <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
                <Button style={button} href={ctaUrl}>{ctaLabel || 'Book now'}</Button>
              </Section>
            )}
            <Section style={divider} />
            <Text style={footer}>
              Radiantilyk Aesthetic · San Jose & San Mateo<br />
              {signOff}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MarketingCampaignEmail,
  subject: (data: Record<string, any>) =>
    (data.subjectLine as string) || 'A note from Radiantilyk Aesthetic',
  displayName: 'Marketing campaign',
  previewData: {
    clientFirstName: 'Jane',
    subjectLine: 'We miss you — come glow with us',
    previewText: '15% off your next visit through Sunday',
    bodyMarkdown:
      "It's been a little while since your last visit, and your provider would love to see you again.\n\nUse code **GLOW15** for 15% off any service booked this month.\n\n- Neurotoxins\n- Filler refresh\n- HydraFacial\n\nReply to this email any time — we're here.",
    ctaLabel: 'Book your visit',
    ctaUrl: 'https://bookrka.com/book',
  },
} satisfies TemplateEntry
