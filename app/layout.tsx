import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "common",
  description: "Find people to do things with nearby",
  metadataBase: new URL('https://common-social.com'),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'common',
  },
  formatDetection: {
    telephone: false,
  },
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F5F0E3',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Platform class for iOS-only CSS: Capacitor iOS shell, iOS Safari and the iOS PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=window.Capacitor,n=navigator,ios=(c&&c.getPlatform&&c.getPlatform()==='ios')||/iPad|iPhone|iPod/.test(n.userAgent)||(n.platform==='MacIntel'&&n.maxTouchPoints>1);if(ios)document.documentElement.classList.add('platform-ios')}catch(e){}})()`,
          }}
        />
        {/* PWA meta tags */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}