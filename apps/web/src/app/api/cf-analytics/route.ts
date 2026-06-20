/**
 * CF Web Analytics GraphQL proxy — edge runtime (next-on-pages compatible)
 * Secrets needed (wrangler secret put / Pages dashboard):
 *   CF_ACCOUNT_ID  — Cloudflare account ID (from dashboard URL)
 *   CF_API_TOKEN   — API token with "Account Analytics: Read" permission
 *   CF_SITE_TAG    — Web Analytics site tag
 */
export const runtime = "edge";

const CF_GQL = "https://api.cloudflare.com/client/v4/graphql";
const CF_SITE_TAG =
  process.env.CF_SITE_TAG ||
  process.env.NEXT_PUBLIC_CF_SITE_TAG ||
  "797ddb8d03954767898daee659caa8de";

function daysAgoDate(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken  = process.env.CF_API_TOKEN;
  const siteTag   = CF_SITE_TAG;

  if (!accountId || !apiToken) {
    return Response.json(
      { error: "CF_ACCOUNT_ID and CF_API_TOKEN secrets are required" },
      { status: 500 }
    );
  }

  const start30d = daysAgoDate(30);
  const start7d  = daysAgoDate(7);
  const endDate  = daysAgoDate(0);

  // ── Countries (top 10, 30d) ──────────────────────────────────────────────
  const countriesQuery = `
    query CountriesQuery($accountId: String!, $siteTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          rumPageloadEventsAdaptiveGroups(
            filter: { AND: [{ siteTag: $siteTag }, { date_geq: $start }, { date_leq: $end }] }
            limit: 10
            orderBy: [count_DESC]
          ) {
            count
            sum { visits }
            dimensions { countryName }
          }
        }
      }
    }
  `;

  // ── Devices (top 5, 30d) ─────────────────────────────────────────────────
  const devicesQuery = `
    query DevicesQuery($accountId: String!, $siteTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          rumPageloadEventsAdaptiveGroups(
            filter: { AND: [{ siteTag: $siteTag }, { date_geq: $start }, { date_leq: $end }] }
            limit: 5
            orderBy: [count_DESC]
          ) {
            count
            sum { visits }
            dimensions { deviceType }
          }
        }
      }
    }
  `;

  // ── Referrers / Traffic Sources (top 10, 30d) ────────────────────────────
  const referrersQuery = `
    query ReferrersQuery($accountId: String!, $siteTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          rumPageloadEventsAdaptiveGroups(
            filter: { AND: [{ siteTag: $siteTag }, { date_geq: $start }, { date_leq: $end }] }
            limit: 10
            orderBy: [count_DESC]
          ) {
            count
            sum { visits }
            dimensions { refererHost }
          }
        }
      }
    }
  `;

  // ── Total visits (30d & 7d) ──────────────────────────────────────────────
  const totalVisitsQuery = `
    query TotalVisitsQuery($accountId: String!, $siteTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          rumPageloadEventsAdaptiveGroups(
            filter: { AND: [{ siteTag: $siteTag }, { date_geq: $start }, { date_leq: $end }] }
            limit: 1000
          ) {
            count
            sum { visits }
          }
        }
      }
    }
  `;

  async function gql(query: string, variables: Record<string, string>) {
    const res = await fetch(CF_GQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`CF GraphQL ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as any;
    if (json.errors?.length) {
      throw new Error(`CF GraphQL error: ${json.errors[0]?.message}`);
    }
    return json;
  }

  try {
    const vars30d = { accountId, siteTag, start: start30d, end: endDate };
    const vars7d  = { accountId, siteTag, start: start7d,  end: endDate };

    const [countriesRes, devicesRes, referrersRes, total30dRes, total7dRes] =
      await Promise.all([
        gql(countriesQuery,   vars30d),
        gql(devicesQuery,     vars30d),
        gql(referrersQuery,   vars30d),
        gql(totalVisitsQuery, vars30d),
        gql(totalVisitsQuery, vars7d),
      ]);

    // Parse countries
    const countryGroups: any[] =
      countriesRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const totalCountryVisits = countryGroups.reduce(
      (s: number, g: any) => s + (g.sum?.visits ?? g.count ?? 0), 0
    );
    const countries = countryGroups
      .filter((g: any) => g.dimensions?.countryName)
      .map((g: any) => ({
        name:  g.dimensions.countryName as string,
        count: (g.sum?.visits ?? g.count) as number,
        pct:   totalCountryVisits > 0
          ? ((g.sum?.visits ?? g.count) as number) / totalCountryVisits
          : 0,
      }));

    // Parse devices
    const deviceGroups: any[] =
      devicesRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const totalDeviceVisits = deviceGroups.reduce(
      (s: number, g: any) => s + (g.sum?.visits ?? g.count ?? 0), 0
    );
    const devices = deviceGroups
      .filter((g: any) => g.dimensions?.deviceType)
      .map((g: any) => ({
        name:  g.dimensions.deviceType as string,
        count: (g.sum?.visits ?? g.count) as number,
        pct:   totalDeviceVisits > 0
          ? ((g.sum?.visits ?? g.count) as number) / totalDeviceVisits
          : 0,
      }));

    // Parse referrers
    const refGroups: any[] =
      referrersRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const totalRefVisits = refGroups.reduce(
      (s: number, g: any) => s + (g.sum?.visits ?? g.count ?? 0), 0
    );
    const trafficSources = refGroups.map((g: any) => ({
      name:  (g.dimensions?.refererHost as string) || "Direct",
      count: (g.sum?.visits ?? g.count) as number,
      pct:   totalRefVisits > 0
        ? ((g.sum?.visits ?? g.count) as number) / totalRefVisits
        : 0,
    }));

    // Parse totals
    const v30groups: any[] =
      total30dRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const v7groups: any[] =
      total7dRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];

    const visitors30d: number = v30groups.reduce((s: number, g: any) => s + (g.count ?? 0), 0);
    const sessions30d: number = v30groups.reduce((s: number, g: any) => s + (g.sum?.visits ?? 0), 0);
    const visitors7d:  number = v7groups.reduce((s: number, g: any) => s + (g.count ?? 0), 0);

    return Response.json(
      { countries, devices, trafficSources, visitors30d, visitors7d, sessions30d },
      {
        headers: {
          // Cache 5 minutes at the edge
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
