import type { Metadata } from "next";
import "./globals.css";
import Pwa from "./pwa";
export const viewport = {themeColor:"#21483c"};

export const metadata: Metadata = {
  title: "Muthi | Rooted in tradition",
  description: "Zulu botanicals, traditional essentials and thoughtful everyday rituals.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true, title:"Muthi", statusBarStyle:"default"},
  icons: {
    apple: "/icons/icon-192.png",
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<Pwa/></body>
    </html>
  );
}
