import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rate My Day",
  description: "A gentle way to remember your year, one day at a time.",
  applicationName: "Rate My Day",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Rate My Day" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fffaf2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
