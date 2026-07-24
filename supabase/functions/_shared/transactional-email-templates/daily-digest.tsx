/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface DigestAppt {
  time: string
  client: string
  service: string
  staff: string
  location: string
}

interface Props {
  dateLabel?: string
  todayCount?: number
  pendingCount?: number
  waitlistCount?: number
  newClientCount?: number
  noShowCount?: number
  revenueLabel?: string
  todayList?: DigestAppt[]
  needsAttention?: { label: string; count: number }[]
  portalUrl?: string
}

const row = { fontSize: '14px', color: '#252220', margin: '6px 0', lineHeight: '1.5' } as const
const muted = { fontSize: '12px', color: '#7a716c', margin: '4px 0' } as const
const stat = { fontSize: '13px', color: '#252220', margin: '4px 0' } as const

const DailyDigestEmail = ({
  dateLabel = 'today',
  todayCount = 0,
  pendingCount = 0,
  waitlistCount = 0,
  newClientCount = 0,
  noShowCount = 0,
  revenueLabel = '$0',
  todayList = [],
  needsAttention = [],
  portalUrl = 'https://bookrka.com/staff/dashboard',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${todayCount} appointments today · ${pendingCount} pending review`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>Good morning — here's your day</Heading>
          <Text style={text}>{dateLabel}</Text>

          <Section style={{ marginTop: 20 }}>
            <Text style={stat}><strong>{todayCount}</strong> appointment{todayCount === 1 ? '' : 's'} on the books today</Text>
            <Text style={stat}><strong>{pendingCount}</strong> pending review</Text>
            <Text style={stat}><strong>{waitlistCount}</strong> open waitlist request{waitlistCount === 1 ? '' : 's'}</Text>
          </Section>

          <Hr style={divider} />

          <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>Yesterday at a glance</Heading>
          <Text style={stat}>Revenue (completed): <strong>{revenueLabel}</strong></Text>
          <Text style={stat}>New clients: <strong>{newClientCount}</strong></Text>
          <Text style={stat}>No-shows: <strong>{noShowCount}</strong></Text>

          {needsAttention.length > 0 && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>Needs attention</Heading>
              {needsAttention.map((n, i) => (
                <Text key={i} style={row}>• {n.label}: <strong>{n.count}</strong></Text>
              ))}
            </>
          )}

          {todayList.length > 0 && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>Today's schedule</Heading>
              {todayList.map((a, i) => (
                <Section key={i} style={{ borderLeft: '2px solid #e6dfd6', paddingLeft: 12, margin: '10px 0' }}>
                  <Text style={{ ...row, margin: '0 0 2px' }}><strong>{a.time}</strong> — {a.client}</Text>
                  <Text style={muted}>{a.service} · {a.staff} · {a.location}</Text>
                </Section>
              ))}
            </>
          )}

          <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
            <a href={portalUrl} style={{ color: '#c96a4d', fontSize: '14px', fontWeight: 500 }}>
              Open staff portal →
            </a>
          </Section>

          <Hr style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · Daily digest</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DailyDigestEmail,
  subject: (d: Record<string, any>) =>
    `Daily digest — ${d.todayCount ?? 0} appointment${d.todayCount === 1 ? '' : 's'} today`,
  displayName: 'Daily admin digest',
  previewData: {
    dateLabel: 'Monday, May 12, 2026',
    todayCount: 6,
    pendingCount: 2,
    waitlistCount: 3,
    newClientCount: 1,
    noShowCount: 0,
    revenueLabel: '$1,840',
    todayList: [
      { time: '10:00 AM', client: 'Jane Doe', service: 'Neurotoxins', staff: 'Kamaren', location: 'San Jose' },
      { time: '11:30 AM', client: 'Sara Smith', service: 'Lip filler', staff: 'Kamaren', location: 'San Jose' },
    ],
    needsAttention: [
      { label: 'Awaiting consents', count: 3 },
      { label: 'Missing card on file', count: 1 },
      { label: 'No-show ready to charge', count: 0 },
    ],
    portalUrl: 'https://bookrka.com/staff/dashboard',
  },
} satisfies TemplateEntry
