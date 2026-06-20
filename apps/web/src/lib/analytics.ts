export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("minicard_session_id");
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("minicard_session_id", id);
  }
  return id;
}

export async function trackEvent(eventName: string, metadata?: Record<string, any>) {
  if (typeof window === "undefined") return;

  // Simple session-level deduplication for pageviews and wallet connections
  if (eventName === "pageview" || eventName === "wallet_connected") {
    const key = `tracked_${eventName}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  }

  try {
    const sessionId = getSessionId();
    const referrer = document.referrer;

    await fetch("/api/cf-analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, sessionId, referrer, metadata }),
    });
  } catch (err) {
    console.error("Tracking error:", err);
  }
}
