import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Call & Text Log",
  description: "Local archive of SMS, MMS, and call history",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
