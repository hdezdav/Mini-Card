import posthog from 'posthog-js'

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

if (token) {
  posthog.init(token, {
    api_host: host,
    person_profiles: 'identified_only', // recommended for compliance/privacy
    capture_pageview: true,
    defaults: '2026-01-30'
  })
}
