/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  brandMark,
  button,
  card,
  container,
  divider,
  footer,
  h1,
  main,
  text,
} from './_brand.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to finish booking with Radiantilyk Aesthetic</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brandMark}>Radiantilyk Aesthetic</Text>
          <Heading style={h1}>Confirm your email</Heading>
          <Text style={text}>
            Welcome to {siteName}. Please confirm your email address so we can
            keep you updated on your appointment requests, confirmations, and
            reminders.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirm email
          </Button>
          <Section style={divider} />
          <Text style={footer}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
