import { ClerkProvider } from "@clerk/nextjs";
import { TRPCProvider } from "./providers";
import "./globals.css";

// Don't prerender — the layout mounts ClerkProvider which validates its key
// at render time, so we defer to request-time evaluation.
export const dynamic = "force-dynamic";

export const metadata = { title: "WMS", description: "Warehouse Management System" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
