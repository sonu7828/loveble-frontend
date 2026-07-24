/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import {
  brandMark, card, container, divider, footer, h1, main, text,
} from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientFirstName?: string
  serviceName?: string
  title?: string
  bodyMarkdown?: string
}

function renderBlocks(md: string) {
  const lines = md.split(/\r?\n/)
  const out: React.ReactNode[] = []
  let bullets: string[] = []
  const flushBullets = (key: string) => {
    if (!bullets.length) return
    out.push(
      <ul key={`ul-${key}`} style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
        {bullets.map((b, i) => <li key={i} style={{ ...text, margin: '4px 0' }}>{b}</li>)}
      </ul>
    )
    bullets = []
  }
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) { flushBullets(`b${i}`); return }
    if (line.startsWith('### ')) { flushBullets(`b${i}`); out.push(<Text key={i} style={{ ...text, fontSize: '15px', fontWeight: 600, margin: '14px 0 6px', color: '#2c241f' }}>{line.slice(4)}</Text>); return }
    if (line.startsWith('## ')) { flushBullets(`b${i}`); out.push(<Heading key={i} as="h2" style={{ ...h1, fontSize: '18px', margin: '20px 0 8px' }}>{line.slice(3)}</Heading>); return }
    if (line.startsWith('- ')) { bullets.push(line.slice(2)); return }
    flushBullets(`b${i}`)
    out.push(<Text key={i} style={text}>{line}</Text>)
  })
  flushBullets('end')
  return out
}

const PostOpEmail = ({
  clientFirstName = 'there',
  serviceName = 'your treatment',
  title = 'After-Care Instructions',
  bodyMarkdown = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${title} — ${serviceName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>Hi {clientFirstName}, thank you for visiting today. Below are your post-treatment instructions for <strong>{serviceName}</strong>. Please save this email for reference and follow each step.</Text>
          {renderBlocks(bodyMarkdown)}
          <Section style={divider} />
          <Text style={footer}>
            <strong>Radiantilyk Aesthetic</strong><br />
            San Jose Studio · 2100 Curtner Ave, Ste 1B, San Jose, CA 95124<br />
            San Mateo Studio · 1528 S El Camino Real, #200, San Mateo, CA 94402<br />
            408-351-1873 · Reply to this email or call your provider for any concerns.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PostOpEmail,
  subject: (d: Record<string, any>) => `${d?.title ?? 'After-Care Instructions'} — ${d?.serviceName ?? 'Your Visit'}`,
  displayName: 'Post-op instructions',
  previewData: {
    clientFirstName: 'Jane',
    serviceName: 'Botox',
    title: 'Neurotoxin After-Care',
    bodyMarkdown: '## After Your Visit\n- Stay upright for 4 hours\n- No exercise today\n\n### When to Call\n- Drooping eyelid\n- Difficulty breathing',
  },
} satisfies TemplateEntry
