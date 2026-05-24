import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Call & Text Log",
  description: "Local archive of SMS, MMS, and call history",
};

// Runs before paint to avoid a flash of the wrong theme on load.
const themeScript = `(function(){try{var s=localStorage.getItem('theme');var p=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&p))document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
