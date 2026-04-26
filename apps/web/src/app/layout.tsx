import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TRPCProvider } from "./providers";
import "./globals.css";

// Don't prerender — the layout mounts ClerkProvider which validates its key
// at render time, so we defer to request-time evaluation.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "stacks — warehouse that feels good",
  description: "Warehouse Management System",
};

// Locks the viewport so a missed tap doesn't pinch-zoom the dashboard
// into oblivion and so the page doesn't scroll horizontally on a
// stray overflow. App router reads this from a dedicated `viewport`
// export (separate from `metadata`).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
};

// Brand typography: Fraunces (display, italic-friendly), Geist (body),
// JetBrains Mono (SKUs + numerics). Loaded via next/font so CSS is
// inlined and no extra request hits Google at runtime.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Fallback URLs tell Clerk where to go when the sign-in / sign-up
    // flow completes and there's no explicit `redirect_url` on the
    // request (e.g. someone following an invite link). Without these,
    // the user lands on Clerk's own "You're signed in" screen instead
    // of bouncing back into the WMS.
    <ClerkProvider
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/"
    >
      <html lang="en" className={`${fraunces.variable} ${geist.variable} ${mono.variable}`}>
        <body className="min-h-screen antialiased">
          <TRPCProvider>{children}</TRPCProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
