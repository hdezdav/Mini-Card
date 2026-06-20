/**
 * CF Zone Analytics GraphQL proxy — edge runtime
 * Uses httpRequestsAdaptiveGroups (account-level) filtered to minicard.fun
 *
 * Secrets needed:
 *   CF_ACCOUNT_ID  — Cloudflare account ID (from dashboard URL)
 *   CF_API_TOKEN   — API token with "Account Analytics: Read" permission
 *   CF_HOST        — hostname to filter (default: minicard.fun)
 */
export const runtime = "edge";

const CF_GQL = "https://api.cloudflare.com/client/v4/graphql";
const CF_HOST = process.env.CF_HOST || "minicard.fun";

function daysAgoDate(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function gql(
  apiToken: string,
  query: string,
  variables: Record<string, string>
) {
  const res = await fetch(CF_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok)
    throw new Error(`CF GraphQL ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as any;
  if (json.errors?.length) {
    throw new Error(`CF GraphQL error: ${json.errors[0]?.message}`);
  }
  return json;
}

export async function GET() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const host = CF_HOST;

  if (!accountId || !apiToken) {
    return Response.json(
      { error: "CF_ACCOUNT_ID and CF_API_TOKEN secrets are required" },
      { status: 500 }
    );
  }

  const start30d = daysAgoDate(30);
  const start7d = daysAgoDate(7);
  const start1d = daysAgoDate(1);
  const endDate = daysAgoDate(0);

  // ── Countries (30d, top 10) ───────────────────────────────────────────────
  const countriesQuery = `
    query($accountId: String!, $host: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          httpRequestsAdaptiveGroups(
            filter: {
              AND: [
                { clientRequestHTTPHost: $host }
                { date_geq: $start }
                { date_leq: $end }
              ]
            }
            limit: 10
            orderBy: [count_DESC]
          ) {
            count
            dimensions { clientCountryName }
          }
        }
      }
    }
  `;

  // ── Daily requests (30d) ─────────────────────────────────────────────────
  const dailyQuery = `
    query($accountId: String!, $host: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          httpRequestsAdaptiveGroups(
            filter: {
              AND: [
                { clientRequestHTTPHost: $host }
                { date_geq: $start }
                { date_leq: $end }
              ]
            }
            limit: 31
            orderBy: [date_ASC]
          ) {
            count
            dimensions { date }
          }
        }
      }
    }
  `;

  // ── Devices (30d, top 5) ─────────────────────────────────────────────────
  const devicesQuery = `
    query($accountId: String!, $host: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          httpRequestsAdaptiveGroups(
            filter: {
              AND: [
                { clientRequestHTTPHost: $host }
                { date_geq: $start }
                { date_leq: $end }
              ]
            }
            limit: 5
            orderBy: [count_DESC]
          ) {
            count
            dimensions { clientDeviceType }
          }
        }
      }
    }
  `;

  // ── Browsers (30d, top 5) ────────────────────────────────────────────────
  const browsersQuery = `
    query($accountId: String!, $host: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          httpRequestsAdaptiveGroups(
            filter: {
              AND: [
                { clientRequestHTTPHost: $host }
                { date_geq: $start }
                { date_leq: $end }
              ]
            }
            limit: 5
            orderBy: [count_DESC]
          ) {
            count
            dimensions { userAgentBrowser }
          }
        }
      }
    }
  `;

  // ── Total requests 30d & 7d & 1d ─────────────────────────────────────────
  const totalQuery = `
    query($accountId: String!, $host: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          httpRequestsAdaptiveGroups(
            filter: {
              AND: [
                { clientRequestHTTPHost: $host }
                { date_geq: $start }
                { date_leq: $end }
              ]
            }
            limit: 1000
          ) {
            count
          }
        }
      }
    }
  `;

  try {
    const vars30d = { accountId, host, start: start30d, end: endDate };
    const vars7d = { accountId, host, start: start7d, end: endDate };
    const vars1d = { accountId, host, start: start1d, end: endDate };

    const [
      countriesRes,
      dailyRes,
      devicesRes,
      browsersRes,
      total30dRes,
      total7dRes,
      total1dRes,
    ] = await Promise.all([
      gql(apiToken, countriesQuery, vars30d),
      gql(apiToken, dailyQuery, vars30d),
      gql(apiToken, devicesQuery, vars30d),
      gql(apiToken, browsersQuery, vars30d),
      gql(apiToken, totalQuery, vars30d),
      gql(apiToken, totalQuery, vars7d),
      gql(apiToken, totalQuery, vars1d),
    ]);

    // ── Parse countries ─────────────────────────────────────────────────────
    const countryGroups: any[] =
      countriesRes?.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups ??
      [];
    const totalCountryReqs = countryGroups.reduce(
      (s: number, g: any) => s + (g.count ?? 0),
      0
    );
    const countries = countryGroups
      .filter((g: any) => g.dimensions?.clientCountryName)
      .map((g: any) => ({
        name: g.dimensions.clientCountryName as string,
        count: g.count as number,
        pct: totalCountryReqs > 0 ? (g.count as number) / totalCountryReqs : 0,
      }));

    // ── Parse daily chart data ──────────────────────────────────────────────
    const dailyGroups: any[] =
      dailyRes?.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const dailyChart = dailyGroups.map((g: any) => ({
      date: g.dimensions.date as string,
      requests: g.count as number,
    }));

    // ── Parse devices ───────────────────────────────────────────────────────
    const deviceGroups: any[] =
      devicesRes?.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const totalDeviceReqs = deviceGroups.reduce(
      (s: number, g: any) => s + (g.count ?? 0),
      0
    );
    const devices = deviceGroups
      .filter((g: any) => g.dimensions?.clientDeviceType)
      .map((g: any) => ({
        name: g.dimensions.clientDeviceType as string,
        count: g.count as number,
        pct: totalDeviceReqs > 0 ? (g.count as number) / totalDeviceReqs : 0,
      }));

    // ── Parse browsers ──────────────────────────────────────────────────────
    const browserGroups: any[] =
      browsersRes?.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups ??
      [];
    const totalBrowserReqs = browserGroups.reduce(
      (s: number, g: any) => s + (g.count ?? 0),
      0
    );
    const browsers = browserGroups
      .filter((g: any) => g.dimensions?.userAgentBrowser)
      .map((g: any) => ({
        name: g.dimensions.userAgentBrowser as string,
        count: g.count as number,
        pct:
          totalBrowserReqs > 0 ? (g.count as number) / totalBrowserReqs : 0,
      }));

    // ── Parse totals ────────────────────────────────────────────────────────
    const v30groups: any[] =
      total30dRes?.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups ??
      [];
    const v7groups: any[] =
      total7dRes?.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const v1groups: any[] =
      total1dRes?.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups ?? [];

    const requests30d: number = v30groups.reduce(
      (s: number, g: any) => s + (g.count ?? 0),
      0
    );
    const requests7d: number = v7groups.reduce(
      (s: number, g: any) => s + (g.count ?? 0),
      0
    );
    const requests1d: number = v1groups.reduce(
      (s: number, g: any) => s + (g.count ?? 0),
      0
    );

    // Keep legacy field names so the stats page doesn't break
    return Response.json(
      {
        countries,
        devices,
        browsers,
        dailyChart,
        trafficSources: [], // not available at account level without zone plan
        visitors30d: requests30d,
        visitors7d: requests7d,
        visitors1d: requests1d,
        sessions30d: requests30d,
        // metadata
        host,
        source: "httpRequestsAdaptiveGroups",
        note: "Includes all HTTP requests (static assets, API, crawlers). For page-views only, upgrade to Pro and use rumPageloadEventsAdaptiveGroups.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    console.error("CF Analytics GraphQL error:", err);
    return Response.json(
      { error: err.message ?? "GraphQL query failed" },
      { status: 502 }
    );
  }
}
