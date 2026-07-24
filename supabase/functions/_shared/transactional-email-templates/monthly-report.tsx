/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface ServiceRow {
  name: string
  count: number
  revenueLabel: string
}

interface ApptRow { client: string; date: string; service: string; staff: string }

interface Props {
  periodLabel?: string
  totalBookings?: number
  completedCount?: number
  noShowCount?: number
  cancelledCount?: number
  newClientCount?: number
  revenueLabel?: string
  services?: ServiceRow[]
  byCategory?: ServiceRow[]
  byLocation?: { name: string; count: number }[]
  byStaff?: { name: string; count: number }[]
  missingCharts?: ApptRow[]
  missingGFE?: ApptRow[]
  missingChartsCount?: number
  missingGFECount?: number
  portalUrl?: string
}


const row = { fontSize: '14px', color: '#252220', margin: '4px 0', lineHeight: '1.5' } as const
const stat = { fontSize: '13px', color: '#252220', margin: '4px 0' } as const
const th = { fontSize: '11px', color: '#7a716c', textTransform: 'uppercase' as const, letterSpacing: '0.05em', textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #e6dfd6' }
const td = { fontSize: '13px', color: '#252220', padding: '6px 8px', borderBottom: '1px solid #f0eae0' }
const tdNum = { ...td, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }

const MonthlyReportEmail = ({
  periodLabel = 'this month',
  totalBookings = 0,
  completedCount = 0,
  noShowCount = 0,
  cancelledCount = 0,
  newClientCount = 0,
  revenueLabel = '$0',
  services = [],
  byCategory = [],
  byLocation = [],
  byStaff = [],
  missingCharts = [],
  missingGFE = [],
  missingChartsCount = 0,
  missingGFECount = 0,
  portalUrl = 'https://bookrka.com/staff/reports',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Monthly report — ${revenueLabel} · ${completedCount} services`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>Monthly report</Heading>
          <Text style={text}>{periodLabel}</Text>

          <Section style={{ marginTop: 20 }}>
            <Text style={stat}>Est. revenue: <strong>{revenueLabel}</strong></Text>
            <Text style={stat}>Total bookings: <strong>{totalBookings}</strong></Text>
            <Text style={stat}>Completed: <strong>{completedCount}</strong></Text>
            <Text style={stat}>No-shows: <strong>{noShowCount}</strong> · Cancelled: <strong>{cancelledCount}</strong></Text>
            <Text style={stat}>New clients: <strong>{newClientCount}</strong></Text>
          </Section>

          <Hr style={divider} />

          <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>By category</Heading>
          {byCategory.length === 0 ? (
            <Text style={row}>No categorized services this period.</Text>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Category</th>
                  <th style={{ ...th, textAlign: 'right' }}>Count</th>
                  <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c, i) => (
                  <tr key={i}>
                    <td style={td}>{c.name}</td>
                    <td style={tdNum}>{c.count}</td>
                    <td style={tdNum}>{c.revenueLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Hr style={divider} />

          <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>All services performed</Heading>

          {services.length === 0 ? (
            <Text style={row}>No services performed this period.</Text>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Service</th>
                  <th style={{ ...th, textAlign: 'right' }}>Count</th>
                  <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={i}>
                    <td style={td}>{s.name}</td>
                    <td style={tdNum}>{s.count}</td>
                    <td style={tdNum}>{s.revenueLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {byLocation.length > 0 && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>By location</Heading>
              {byLocation.map((l, i) => (
                <Text key={i} style={row}>• {l.name}: <strong>{l.count}</strong></Text>
              ))}
            </>
          )}

          {byStaff.length > 0 && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>By provider</Heading>
              {byStaff.map((s, i) => (
                <Text key={i} style={row}>• {s.name}: <strong>{s.count}</strong></Text>
              ))}
            </>
          )}

          <Hr style={divider} />
          <Heading as="h2" style={{ ...h1, fontSize: '18px', margin: '8px 0 12px' }}>
            Compliance — needs completion
          </Heading>
          <Text style={stat}>Missing charts (completed visits without a signed note): <strong>{missingChartsCount}</strong></Text>
          <Text style={stat}>Missing GFE (completed visits, client has no GFE on file): <strong>{missingGFECount}</strong></Text>

          {missingCharts.length > 0 && (
            <>
              <Heading as="h3" style={{ ...h1, fontSize: '15px', margin: '14px 0 6px' }}>Charts to finish</Heading>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Client</th>
                    <th style={th}>Service</th>
                    <th style={th}>Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {missingCharts.map((a, i) => (
                    <tr key={i}>
                      <td style={td}>{a.date}</td>
                      <td style={td}>{a.client}</td>
                      <td style={td}>{a.service}</td>
                      <td style={td}>{a.staff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {missingGFE.length > 0 && (
            <>
              <Heading as="h3" style={{ ...h1, fontSize: '15px', margin: '14px 0 6px' }}>GFE to complete</Heading>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Client</th>
                    <th style={th}>Service</th>
                    <th style={th}>Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {missingGFE.map((a, i) => (
                    <tr key={i}>
                      <td style={td}>{a.date}</td>
                      <td style={td}>{a.client}</td>
                      <td style={td}>{a.service}</td>
                      <td style={td}>{a.staff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
            <a href={portalUrl} style={{ color: '#c96a4d', fontSize: '14px', fontWeight: 500 }}>
              Open full report →
            </a>
          </Section>

          <Hr style={divider} />
          <Text style={footer}>Radiantilyk Aesthetic · Monthly report</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MonthlyReportEmail,
  subject: (d: Record<string, any>) =>
    `Monthly report — ${d.periodLabel ?? 'this month'} · ${d.revenueLabel ?? '$0'}`,
  displayName: 'Monthly admin report',
  previewData: {
    periodLabel: 'May 1–31, 2026',
    totalBookings: 142,
    completedCount: 128,
    noShowCount: 4,
    cancelledCount: 10,
    newClientCount: 22,
    revenueLabel: '$48,250',
    services: [
      { name: 'Botox / Neurotoxins', count: 42, revenueLabel: '$16,800' },
      { name: 'Lip filler', count: 18, revenueLabel: '$10,800' },
      { name: 'Hydrafacial', count: 24, revenueLabel: '$6,000' },
    ],
    byCategory: [
      { name: 'Neurotoxin', count: 42, revenueLabel: '$16,800' },
      { name: 'Filler', count: 18, revenueLabel: '$10,800' },
      { name: 'Laser', count: 24, revenueLabel: '$6,000' },
      { name: 'Body Contouring', count: 8, revenueLabel: '$4,200' },
      { name: 'Weight Loss', count: 14, revenueLabel: '$7,000' },
      { name: 'Other', count: 22, revenueLabel: '$3,450' },
    ],
    byLocation: [{ name: 'San Jose', count: 92 }, { name: 'San Mateo', count: 36 }],
    byStaff: [{ name: 'Kamaren', count: 64 }, { name: 'Kiem', count: 48 }],
    portalUrl: 'https://bookrka.com/staff/reports',
  },
} satisfies TemplateEntry
