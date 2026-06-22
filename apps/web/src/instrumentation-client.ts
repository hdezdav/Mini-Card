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
} else if (process.env.NODE_ENV !== 'production') {
  // Surface a missing-token case loudly in dev so it's not silent in prod.
  // NEXT_PUBLIC_* vars must be present at BUILD time to be inlined into the
  // client bundle — on Cloudflare Pages they must be plain env vars, NOT
  // encrypted secrets (encrypted secrets are runtime-only and never reach the build).
  console.warn(
    '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not defined — PostHog will not initialize. ' +
    'Ensure the variable is available at build time (not as an encrypted Cloudflare Secret).'
  )
}
