import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function getDb() {
  try {
    const context = getRequestContext() as any;
    const env = context?.env || {};
    return env.DB || (process.env.DB as any);
  } catch {
    return process.env.DB as any;
  }
}

// Helper to determine device type
function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"))) {
    return "Tablet";
  }
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("ipod") || ua.includes("android")) {
    return "Mobile";
  }
  return "Desktop";
}

// Helper to extract traffic source/referrer
function getTrafficSource(referrerUrl: string | null, userAgent: string): string {
  if (userAgent.toLowerCase().includes("minipay")) {
    return "MiniPay";
  }
  if (!referrerUrl) return "Direct";
  try {
    const url = new URL(referrerUrl);
    if (url.hostname.includes("minipay") || url.searchParams.get("provider") === "minipay") {
      return "MiniPay";
    }
    return url.hostname;
  } catch {
    if (referrerUrl.toLowerCase().includes("minipay")) {
      return "MiniPay";
    }
    return "Direct";
  }
}

// Dynamically generate flag emoji from country code (e.g. 'US' -> '🇺🇸')
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🏳️";
  }
}

const COMMON_COUNTRIES: Record<string, string> = {
  US: "United States",
  CO: "Colombia",
  KE: "Kenya",
  ID: "Indonesia",
  IN: "India",
  AR: "Argentina",
  NG: "Nigeria",
  DE: "Germany",
  MX: "Mexico",
  BY: "Belarus",
  ES: "Spain",
  BR: "Brazil",
};

function getCountryName(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (COMMON_COUNTRIES[code]) return COMMON_COUNTRIES[code];
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

// GET handler: retrieve analytics stats
export async function GET() {
  const db = getDb();

  if (!db) {
    // Graceful fallback: return the exact demo statistics provided by the user
    return NextResponse.json(
      {
        visitors30d: 358,
        visitors7d: 83,
        sessions30d: 902,
        countries: [
          { name: "🇺🇸 United States", count: 124, pct: 0.35 },
          { name: "🇨🇴 Colombia", count: 110, pct: 0.31 },
          { name: "🇰🇪 Kenya", count: 55, pct: 0.15 },
          { name: "🇮🇩 Indonesia", count: 11, pct: 0.03 },
          { name: "🇮🇳 India", count: 7, pct: 0.02 },
          { name: "🇦🇷 Argentina", count: 7, pct: 0.02 },
          { name: "🇳🇬 Nigeria", count: 7, pct: 0.02 },
          { name: "🇩🇪 Germany", count: 5, pct: 0.01 },
          { name: "🇲🇽 Mexico", count: 4, pct: 0.01 },
          { name: "🇧🇾 Belarus", count: 3, pct: 0.01 },
        ],
        devices: [
          { name: "Desktop", count: 197, pct: 0.55 },
          { name: "Mobile", count: 161, pct: 0.45 },
          { name: "Tablet", count: 2, pct: 0.01 },
        ],
        trafficSources: [
          { name: "Direct", count: 354, pct: 0.99 },
          { name: "MiniPay", count: 4, pct: 0.01 },
        ],
        funnel: {
          visitors: 358,
          walletConnected: 46,
          playInitiated: 55,
          playCompleted: 55,
        },
        warning: "Cloudflare D1 binding 'DB' is not configured yet. Showing demo data.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=10",
        },
      }
    );
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 86400;
    const sevenDaysAgo = now - 7 * 86400;

    // Fetch metric aggregates in parallel
    const [
      visitors30dRes,
      visitors7dRes,
      sessions30dRes,
      countriesRes,
      devicesRes,
      sourcesRes,
      funnelVisitorsRes,
      funnelWalletRes,
      funnelPlayInitRes,
      funnelPlayDoneRes,
    ] = await Promise.all([
      db
        .prepare(
          "SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE event_name = 'pageview' AND timestamp >= ?"
        )
        .bind(thirtyDaysAgo)
        .first("count"),
      db
        .prepare(
          "SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE event_name = 'pageview' AND timestamp >= ?"
        )
        .bind(sevenDaysAgo)
        .first("count"),
      db
        .prepare("SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp >= ?")
        .bind(thirtyDaysAgo)
        .first("count"),
      db
        .prepare(
          `SELECT country, COUNT(DISTINCT session_id) as count 
           FROM analytics_events 
           WHERE timestamp >= ? AND country IS NOT NULL AND country != ''
           GROUP BY country 
           ORDER BY count DESC 
           LIMIT 10`
        )
        .bind(thirtyDaysAgo)
        .all(),
      db
        .prepare(
          `SELECT device, COUNT(DISTINCT session_id) as count 
           FROM analytics_events 
           WHERE timestamp >= ? AND device IS NOT NULL AND device != ''
           GROUP BY device 
           ORDER BY count DESC`
        )
        .bind(thirtyDaysAgo)
        .all(),
      db
        .prepare(
          `SELECT referrer as name, COUNT(DISTINCT session_id) as count 
           FROM analytics_events 
           WHERE timestamp >= ? AND referrer IS NOT NULL AND referrer != ''
           GROUP BY referrer 
           ORDER BY count DESC 
           LIMIT 10`
        )
        .bind(thirtyDaysAgo)
        .all(),
      db
        .prepare(
          "SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE event_name = 'pageview' AND timestamp >= ?"
        )
        .bind(thirtyDaysAgo)
        .first("count"),
      db
        .prepare(
          "SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE event_name = 'wallet_connected' AND timestamp >= ?"
        )
        .bind(thirtyDaysAgo)
        .first("count"),
      db
        .prepare(
          "SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE event_name = 'play_initiated' AND timestamp >= ?"
        )
        .bind(thirtyDaysAgo)
        .first("count"),
      db
        .prepare(
          "SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE event_name = 'play_completed' AND timestamp >= ?"
        )
        .bind(thirtyDaysAgo)
        .first("count"),
    ]);

    const countryResults = (countriesRes.results || []) as any[];
    const totalCountryHits = countryResults.reduce((s, r) => s + (r.count || 0), 0);
    const countries = countryResults.map((r) => {
      const code = r.country || "US";
      return {
        name: `${getFlagEmoji(code)} ${getCountryName(code)}`,
        count: r.count || 0,
        pct: totalCountryHits > 0 ? (r.count || 0) / totalCountryHits : 0,
      };
    });

    const deviceResults = (devicesRes.results || []) as any[];
    const totalDeviceHits = deviceResults.reduce((s, r) => s + (r.count || 0), 0);
    const devices = deviceResults.map((r) => ({
      name: r.device || "Desktop",
      count: r.count || 0,
      pct: totalDeviceHits > 0 ? (r.count || 0) / totalDeviceHits : 0,
    }));

    const sourceResults = (sourcesRes.results || []) as any[];
    const totalSourceHits = sourceResults.reduce((s, r) => s + (r.count || 0), 0);
    const trafficSources = sourceResults.map((r) => ({
      name: r.name || "Direct",
      count: r.count || 0,
      pct: totalSourceHits > 0 ? (r.count || 0) / totalSourceHits : 0,
    }));

    return NextResponse.json({
      visitors30d: Number(visitors30dRes || 0),
      visitors7d: Number(visitors7dRes || 0),
      sessions30d: Number(sessions30dRes || 0),
      countries,
      devices,
      trafficSources,
      funnel: {
        visitors: Number(funnelVisitorsRes || 0),
        walletConnected: Number(funnelWalletRes || 0),
        playInitiated: Number(funnelPlayInitRes || 0),
        playCompleted: Number(funnelPlayDoneRes || 0),
      },
    });
  } catch (err: any) {
    console.error("D1 Analytics GET error:", err);
    return NextResponse.json({ error: err.message || "Failed to retrieve stats" }, { status: 500 });
  }
}

// POST handler: record tracking events
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, warning: "D1 database not bound" });
  }

  try {
    const body = await req.json();
    const { eventName, sessionId, referrer } = body;
    if (!eventName || !sessionId) {
      return NextResponse.json({ error: "Missing eventName or sessionId" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const countryCode = req.headers.get("cf-ipcountry") || "US";
    const device = getDeviceType(userAgent);
    const trafficSource = getTrafficSource(referrer, userAgent);
    const nowSeconds = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO analytics_events (session_id, event_name, country, device, referrer, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(sessionId, eventName, countryCode, device, trafficSource, nowSeconds)
      .run();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("D1 Analytics POST error:", err);
    return NextResponse.json({ error: err.message || "Failed to record event" }, { status: 500 });
  }
}
