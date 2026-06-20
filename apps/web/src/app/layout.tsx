import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniCard",
  description: "Minipay card experience inspired by Balatro pixel art",
  icons: {
    icon: "/favicon.svg",
  },
  other: {
    "talentapp:project_verification": "2c3ccaeb4c6fa4451f9ea1b16da94c4e54861c10418c17765bff26deb12760d4d6ae1b221f983854d723eb0a0c688b004b0e8fada0181d1df4c7ebd9b6984e06",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        {/* Cloudflare Web Analytics */}
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "66145d087b29488ba523bc4edf037182"}'
        />
        {/* End Cloudflare Web Analytics */}
      </body>
    </html>
  );
}