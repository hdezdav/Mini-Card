import { NextRequest } from "next/server";

export const runtime = "edge";

// Cache project ID in memory to avoid fetching it on every request
let cachedProjectId: string | number | null = null;

// Resolve the numeric project id that the HogQL query endpoint expects
// (/api/projects/{id}/query/). We match the project whose api_token equals the
// public project token the client SDK uses, so we always query the project that
// is actually receiving events — regardless of which project is "active" for the
// personal API key (which may belong to multiple orgs/projects).
async function resolveProjectId(
  personalApiKey: string,
  queryHost: string,
  publicToken: string | undefined
): Promise<number> {
  const meRes = await fetch(`${queryHost}/api/users/@me/`, {
    headers: { Authorization: `Bearer ${personalApiKey}` },
  });
  if (!meRes.ok) {
    const errText = await meRes.text();
    throw new Error(`Failed to resolve Project ID from PostHog @me endpoint (${meRes.status}): ${errText}`);
  }
  const me: any = await meRes.json();

  // Collect every project-like object we can see in the @me response.
  const candidates: any[] = [];
  if (me.team) candidates.push(me.team);
  if (Array.isArray(me.organization?.projects)) candidates.push(...me.organization.projects);
  if (Array.isArray(me.organization?.teams)) candidates.push(...me.organization.teams);
  if (Array.isArray(me.projects)) candidates.push(...me.projects);

  // If we have a public token, prefer the project that matches it.
  if (publicToken) {
    const match = candidates.find((p) => p?.api_token === publicToken);
    if (match?.id != null) return Number(match.id);
  }

  // Fallback: the currently active team (previous behavior), only if it matches
  // the public token or we have no token to compare against.
  if (me.team?.id != null && (!publicToken || me.team.api_token === publicToken)) {
    return Number(me.team.id);
  }

  // Last resort: if the personal key only sees one project, use it.
  if (candidates.length === 1 && candidates[0]?.id != null) {
    return Number(candidates[0].id);
  }

  throw new Error(
    publicToken
      ? `No PostHog project matched the public token (${publicToken}). Check that the personal API key has access to that project.`
      : "Could not resolve a PostHog project. Set POSTHOG_PROJECT_ID or NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN."
  );
}

export async function GET(req: NextRequest) {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  let projectId = process.env.POSTHOG_PROJECT_ID || cachedProjectId;
  const ingestHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  // Determine query host from ingest host
  const queryHost = ingestHost.includes("eu") 
    ? "https://eu.posthog.com" 
    : "https://us.posthog.com";

  if (!personalApiKey) {
    return Response.json({
      configured: false,
      countries: [
        { name: "Colombia", count: 120, pct: 0.50 },
        { name: "United States", count: 72, pct: 0.30 },
        { name: "Argentina", count: 24, pct: 0.10 },
        { name: "Spain", count: 12, pct: 0.05 },
        { name: "Others", count: 12, pct: 0.05 },
      ],
      devices: [
        { name: "Mobile", count: 144, pct: 0.60 },
        { name: "Desktop", count: 84, pct: 0.35 },
        { name: "Tablet", count: 12, pct: 0.05 },
      ],
      browsers: [
        { name: "Chrome", count: 120, pct: 0.50 },
        { name: "Safari", count: 72, pct: 0.30 },
        { name: "Firefox", count: 24, pct: 0.10 },
        { name: "Edge", count: 24, pct: 0.10 },
      ],
      visitors30d: 240,
      visitors7d: 84,
      sessions30d: 310,
      note: "DEMO MODE: Configure POSTHOG_PERSONAL_API_KEY to load live stats."
    }, {
      headers: {
        "Cache-Control": "no-store",
      }
    });
  }

  try {
    // If projectId is still not resolved, derive it from the public token so we
    // always query the SAME project the client SDK is capturing into — instead of
    // blindly trusting whichever project happens to be "active" for the personal key.
    if (!projectId) {
      const publicToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
      projectId = await resolveProjectId(personalApiKey, queryHost, publicToken);
      cachedProjectId = projectId;
    }

    const runHogQL = async (sql: string) => {
      const url = `${queryHost}/api/projects/${projectId}/query/`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${personalApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: sql,
          }
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`PostHog query failed (${res.status}): ${errText}`);
      }

      return await res.json();
    };

    // Run HogQL queries in parallel
    const [
      visitors30dRes,
      visitors7dRes,
      sessions30dRes,
      countriesRes,
      devicesRes,
      browsersRes,
    ] = await Promise.all([
      runHogQL("SELECT count(distinct distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= subtractDays(now(), 30)"),
      runHogQL("SELECT count(distinct distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= subtractDays(now(), 7)"),
      runHogQL("SELECT count(distinct properties.$session_id) FROM events WHERE event = '$pageview' AND timestamp >= subtractDays(now(), 30)"),
      runHogQL("SELECT properties.$geoip_country_name as country, count(distinct distinct_id) as count FROM events WHERE event = '$pageview' AND timestamp >= subtractDays(now(), 30) AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 6"),
      runHogQL("SELECT properties.$device_type as device, count(distinct distinct_id) as count FROM events WHERE event = '$pageview' AND timestamp >= subtractDays(now(), 30) AND device IS NOT NULL GROUP BY device ORDER BY count DESC LIMIT 5"),
      runHogQL("SELECT properties.$browser as browser, count(distinct distinct_id) as count FROM events WHERE event = '$pageview' AND timestamp >= subtractDays(now(), 30) AND browser IS NOT NULL GROUP BY browser ORDER BY count DESC LIMIT 5"),
    ]);

    // Parse results
    const visitors30d = Number(visitors30dRes.results?.[0]?.[0] || 0);
    const visitors7d = Number(visitors7dRes.results?.[0]?.[0] || 0);
    const sessions30d = Number(sessions30dRes.results?.[0]?.[0] || 0);

    const mapResults = (rows: any[][]) => {
      if (!rows || rows.length === 0) return [];
      const total = rows.reduce((acc, row) => acc + Number(row[1] || 0), 0);
      return rows.map((row) => ({
        name: String(row[0] || "Unknown"),
        count: Number(row[1] || 0),
        pct: total > 0 ? Number(row[1] || 0) / total : 0,
      }));
    };

    const countries = mapResults(countriesRes.results || []);
    const devices = mapResults(devicesRes.results || []);
    const browsers = mapResults(browsersRes.results || []);

    return Response.json({
      configured: true,
      countries,
      devices,
      browsers,
      visitors30d,
      visitors7d,
      sessions30d,
      // Surface an empty-project hint so the UI can tell "no data yet" apart from
      // "misconfigured" — avoids the current confusion where zeros look like demo mode.
      note:
        visitors30d === 0 && visitors7d === 0 && sessions30d === 0
          ? "No events found in the last 30 days for the resolved project."
          : undefined,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      }
    });

  } catch (err: any) {
    console.error("PostHog Analytics API Error:", err);
    return Response.json({
      error: err.message || "Failed to fetch stats from PostHog"
    }, { status: 502 });
  }
}
