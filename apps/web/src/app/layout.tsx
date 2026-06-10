import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniCard",
  description: "Minipay card experience inspired by Balatro pixel art",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}