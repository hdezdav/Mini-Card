
export async function trackEvent(eventName: string, metadata?: Record<string, any>) {
  if (typeof window === "undefined") return;

  // Umami automatically tracks page views on load, so we skip manual "pageview" events
  if (eventName === "pageview") return;

  // Simple session-level deduplication for wallet connections
  if (eventName === "wallet_connected") {
    const key = `tracked_${eventName}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  }

  try {
    const windowWithUmami = window as any;
    if (windowWithUmami.umami && typeof windowWithUmami.umami.track === "function") {
      windowWithUmami.umami.track(eventName, metadata);
    }
  } catch (err) {
    console.error("Tracking error:", err);
  }
}
