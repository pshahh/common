import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "common",
  description: "Find people to do things with nearby",
  metadataBase: new URL('https://common-smoky-seven.vercel.app'),
  openGraph: {
    title: "common",
    description: "Find people to do things with nearby",
    siteName: "common",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: "common",
    description: "Find people to do things with nearby",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}