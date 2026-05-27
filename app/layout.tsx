import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif headings — matches the editorial tone on onformfinance.com.
const headingSerif = Cormorant_Garamond({
  variable: "--font-heading-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "OnForm Internal Tool",
  description: "Client financial dashboards for the OnForm team.",
};

// <ClerkProvider> is a React Context that holds the session, user, and config
// for every Clerk component & hook in the tree. It must wrap <html> so that
// both server and client components have access.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${headingSerif.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* `bg-background text-foreground` come from shadcn's @layer base
            (see app/globals.css) — no need to repeat them here. */}
        <body className="min-h-dvh">{children}</body>
      </html>
    </ClerkProvider>
  );
}
