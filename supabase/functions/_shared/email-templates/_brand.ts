// Shared brand styles for Radiantilyk Aesthetic auth emails.
// Body background stays white (#ffffff) per email best practices; the brand
// cream is used for the inner card so the email still feels "RKA".

export const brand = {
  // Colors
  bg: '#ffffff',
  cream: '#fcfbf8',
  card: '#ffffff',
  text: '#252220',          // deep warm charcoal
  muted: '#7a716c',
  border: '#e6dfd6',
  primary: '#c96a4d',       // warm terracotta coral
  primaryFg: '#fcfbf8',
  // Fonts
  serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

export const main = {
  backgroundColor: brand.bg,
  fontFamily: brand.sans,
  color: brand.text,
  margin: 0,
  padding: '32px 0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '0 24px',
}

export const card = {
  backgroundColor: brand.cream,
  border: `1px solid ${brand.border}`,
  borderRadius: '12px',
  padding: '40px 36px',
}

export const brandMark = {
  fontFamily: brand.serif,
  fontSize: '28px',
  fontWeight: 500 as const,
  letterSpacing: '0.02em',
  color: brand.text,
  textAlign: 'center' as const,
  margin: '0 0 28px',
}

export const h1 = {
  fontFamily: brand.serif,
  fontSize: '28px',
  fontWeight: 500 as const,
  color: brand.text,
  margin: '0 0 18px',
  lineHeight: '1.2',
}

export const text = {
  fontFamily: brand.sans,
  fontSize: '15px',
  color: brand.text,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const link = {
  color: brand.primary,
  textDecoration: 'underline',
}

export const button = {
  backgroundColor: brand.primary,
  color: brand.primaryFg,
  fontFamily: brand.sans,
  fontSize: '14px',
  fontWeight: 500 as const,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  borderRadius: '999px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeStyle = {
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: '26px',
  fontWeight: 600 as const,
  letterSpacing: '0.2em',
  color: brand.text,
  backgroundColor: '#ffffff',
  border: `1px solid ${brand.border}`,
  borderRadius: '8px',
  padding: '14px 20px',
  display: 'inline-block',
  margin: '0 0 24px',
}

export const divider = {
  borderTop: `1px solid ${brand.border}`,
  margin: '28px 0 20px',
}

export const footer = {
  fontFamily: brand.sans,
  fontSize: '12px',
  color: brand.muted,
  lineHeight: '1.5',
  margin: '0',
  textAlign: 'center' as const,
}
