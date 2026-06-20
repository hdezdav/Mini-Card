'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from '@posthog/react'
import React from 'react'

if (typeof window !== 'undefined') {
  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
  
  if (token) {
    posthog.init(token, {
      api_host: host,
      person_profiles: 'identified_only', // recommended for compliance/privacy
      capture_pageview: true,
    })
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // If no PostHog key is defined, just render children without the provider to avoid issues
  if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }
  return <PHProvider client={posthog}>{children}</PHProvider>
}
