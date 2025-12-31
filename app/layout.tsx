import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "common",
  description: "Find people to do things with nearby",
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