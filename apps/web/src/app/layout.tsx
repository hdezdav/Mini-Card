import type { Metadata, Viewport } from "next";
import "./globals.css";
// Web analytics (Mixpanel) disabled — not in use. To re-enable, uncomment the
// import and the <Script> block below.
// import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL("https://minicard.fun"),
  title: "MiniCard",
  description: "MiniCard is a card roguelike that reinvents traditional poker. It combines classic hands with modern mechanics, multipliers, and dynamic modifiers to achieve astronomical scores. Choose your strategy, defy the odds, and break the game!",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "MiniCard",
    description: "MiniCard is a card roguelike that reinvents traditional poker. It combines classic hands with modern mechanics, multipliers, and dynamic modifiers to achieve astronomical scores. Choose your strategy, defy the odds, and break the game!",
    url: "https://minicard.fun",
    siteName: "MiniCard",
    images: [
      {
        url: "/assets/opengrahp.png",
        width: 1200,
        height: 630,
        alt: "MiniCard - A poker-inspired roguelike card game",
      },
    ],
    locale: "es",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MiniCard",
    description: "MiniCard is a card roguelike that reinvents traditional poker. It combines classic hands with modern mechanics, multipliers, and dynamic modifiers to achieve astronomical scores. Choose your strategy, defy the odds, and break the game!",
    images: ["/assets/opengrahp.png"],
  },
  other: {
    "talentapp:project_verification": "2c3ccaeb4c6fa4451f9ea1b16da94c4e54861c10418c17765bff26deb12760d4d6ae1b221f983854d723eb0a0c688b004b0e8fada0181d1df4c7ebd9b6984e06",
  },
};

// Explicit viewport for MiniPay mobile-only target. viewport-fit=cover paints
// edge-to-edge under the notch / home indicator (safe-area insets keep content
// clear). Zoom is disabled so the fixed, non-scrolling board can't be pinched
// or auto-zoomed — iPhone Safari zooms the viewport when an input <16px gains
// focus, which would jump the layout. env(safe-area-inset-*) resolves to 0 on
// non-notched devices, so this is a no-op there.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=VT323&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        {/* Mixpanel web analytics disabled — not in use. To re-enable, uncomment this block.
        <Script id="mixpanel-init" strategy="afterInteractive">
          {`(function(e,c){if(!c.__SV){var l,h;window.mixpanel=c;c._i=[];c.init=function(q,r,f){function t(d,a){var g=a.split(".");2==g.length&&(d=d[g[0]],a=g[1]);d[a]=function(){d.push([a].concat(Array.prototype.slice.call(arguments,0)))}}var b=c;"undefined"!==typeof f?b=c[f]=[]:f="mixpanel";b.people=b.people||[];b.toString=function(d){var a="mixpanel";"mixpanel"!==f&&(a+="."+f);d||(a+=" (stub)");return a};b.people.toString=function(){return b.toString(1)+".people (stub)"};l="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders start_session_recording stop_session_recording people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
  for(h=0;h<l.length;h++)t(b,l[h]);var n="set set_once union unset remove delete".split(" ");b.get_group=function(){function d(p){a[p]=function(){b.push([g,[p].concat(Array.prototype.slice.call(arguments,0))])}}for(var a={},g=["get_group"].concat(Array.prototype.slice.call(arguments,0)),m=0;m<n.length;m++)d(n[m]);return a};c._i.push([q,r,f])};c.__SV=1.2;var k=e.createElement("script");k.type="text/javascript";k.async=!0;k.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===
  e.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";e=e.getElementsByTagName("script")[0];e.parentNode.insertBefore(k,e)}})(document,window.mixpanel||[])

  mixpanel.init('990b880192c312d65f3595314352fd2c', {
    autocapture: true,
    record_sessions_percent: 100,
  })`}
        </Script>
        */}
      </body>
    </html>
  );
}