/**
 * CF Web Analytics GraphQL proxy — edge runtime (next-on-pages compatible)
 * Secrets needed (wrangler secret put):
 *   CF_ACCOUNT_ID  — Cloudflare account ID (from dashboard URL)
 *   CF_API_TOKEN   — API token with "Account Analytics: Read" permission
 */
export const runtime = "edge";

const CF_GQL = "https://api.cloudflare.com/client/v4/graphql";
// Public beacon token — same as the JS snippet, safe to hardcode
const CF_SITE_TAG = process.env.CF_SITE_TAG || process.env.NEXT_PUBLIC_CF_SITE_TAG || "797ddb8d03954767898daee659caa8de";

/**
 * Build a date string N days ago in YYYY-MM-DD format.
 */
function daysAgoDate(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const accountId = "b0e89e27389f0291087d80c7da96ac90";
  const apiToken  = "cfut_Q5KhqAehwlKorYqiXWArltrOPktglQgfp6CQqLdqa55b93fd";
  const siteTag   = CF_SITE_TAG;

  const startDate = daysAgoDate(30);
  const endDate = daysAgoDate(0);

  // ── Countries (top 10) ──────────────────────────────────────────────────────
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
            dimensions { countryName }
          }
        }
      }
    }
  `;

  // ── Devices (top 5) ─────────────────────────────────────────────────────────
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
            dimensions { deviceType }
          }
        }
      }
    }
  `;

  // ── Referrers / Traffic Sources (top 10) ────────────────────────────────────
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
            dimensions { refererHost }
          }
        }
      }
    }
  `;

  // ── Total visitors (7d and 30d) ──────────────────────────────────────────────
  const visitorsQuery = `
    query VisitorsQuery($accountId: String!, $siteTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          rumPageloadEventsAdaptiveGroups(
            filter: { AND: [{ siteTag: $siteTag }, { date_geq: $start }, { date_leq: $end }] }
            limit: 1
          ) {
            sum { visits }
            uniq { uniques }
          }
        }
      }
    }
  `;

  const vars30d = { accountId, siteTag, start: startDate, end: endDate };
  const vars7d  = { accountId, siteTag, start: daysAgoDate(7), end: endDate };

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
    return res.json() as Promise<any>;
  }

  try {
    const [countriesRes, devicesRes, referrersRes, visitors30dRes, visitors7dRes] =
      await Promise.all([
        gql(countriesQuery, vars30d),
        gql(devicesQuery, vars30d),
        gql(referrersQuery, vars30d),
        gql(visitorsQuery, vars30d),
        gql(visitorsQuery, vars7d),
      ]);

    // Parse countries
    const countryGroups: any[] =
      countriesRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const totalCountryHits = countryGroups.reduce((s: number, g: any) => s + (g.count ?? 0), 0);
    const countries = countryGroups
      .filter((g: any) => g.dimensions?.countryName)
      .map((g: any) => ({
        name: g.dimensions.countryName as string,
        count: g.count as number,
        pct: totalCountryHits > 0 ? (g.count as number) / totalCountryHits : 0,
      }));

    // Parse devices
    const deviceGroups: any[] =
      devicesRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const totalDeviceHits = deviceGroups.reduce((s: number, g: any) => s + (g.count ?? 0), 0);
    const devices = deviceGroups
      .filter((g: any) => g.dimensions?.deviceType)
      .map((g: any) => ({
        name: g.dimensions.deviceType as string,
        count: g.count as number,
        pct: totalDeviceHits > 0 ? (g.count as number) / totalDeviceHits : 0,
      }));

    // Parse referrers
    const refGroups: any[] =
      referrersRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const totalRefHits = refGroups.reduce((s: number, g: any) => s + (g.count ?? 0), 0);
    const trafficSources = refGroups
      .map((g: any) => ({
        name: (g.dimensions?.refererHost as string) || "Direct",
        count: g.count as number,
        pct: totalRefHits > 0 ? (g.count as number) / totalRefHits : 0,
      }));

    // Parse visitor totals
    const v30groups: any[] =
      visitors30dRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const v7groups: any[] =
      visitors7dRes?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];

    const visitors30d: number = v30groups.reduce((s: number, g: any) => s + (g.uniq?.uniques ?? 0), 0);
    const sessions30d: number = v30groups.reduce((s: number, g: any) => s + (g.sum?.visits ?? 0), 0);
    const visitors7d: number  = v7groups.reduce((s: number, g: any) => s + (g.uniq?.uniques ?? 0), 0);

    return Response.json(
      { countries, devices, trafficSources, visitors30d, visitors7d, sessions30d },
      {
        headers: {
          // Cache for 5 minutes at the edge — fresh enough, saves API calls
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    console.error("CF Analytics GraphQL error:", err);
    return Response.json({ error: err.message ?? "GraphQL query failed" }, { status: 502 });
  }
}
