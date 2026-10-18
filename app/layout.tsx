import "./globals.css";
import type { Metadata, Viewport } from "next";
import InstallAppPrompt from "@/components/pwa/InstallAppPrompt";

export const metadata: Metadata = {
  title: "EduTechLab — Modern Education Management Platform",
  description:
    "Run your school, coaching institute or madrasa with one modern education management platform.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduTechLab",
  },
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#6657e8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EduTechLab" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <InstallAppPrompt />
      </body>
    </html>
  );
}