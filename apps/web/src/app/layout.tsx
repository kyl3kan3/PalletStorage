import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import { TRPCProvider } from "./providers";
import "./globals.css";

// Don't prerender — the layout mounts ClerkProvider which validates its key
// at render time, so we defer to request-time evaluation.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "stacks — warehouse that feels good",
  description: "Warehouse Management System",
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
    <ClerkProvider>
      <html lang="en" className={`${fraunces.variable} ${geist.variable} ${mono.variable}`}>
        <body className="min-h-screen antialiased">
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
