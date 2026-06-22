import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

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
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="c943aae0-d766-4b93-b3e0-ae33c31f75fa"
        />
      </body>
    </html>
  );
}