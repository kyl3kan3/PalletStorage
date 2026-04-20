import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">WMS</h1>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton />
        </SignedOut>
      </div>

      <SignedIn>
        <nav className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card href="/warehouses" title="Warehouses" desc="Sites, zones, racks" />
          <Card href="/inventory" title="Inventory" desc="Pallets & locations" />
          <Card href="/products" title="Products" desc="SKU catalog" />
          <Card href="/inbound" title="Inbound" desc="Receiving" />
          <Card href="/outbound" title="Outbound" desc="Picking & shipping" />
          <Card href="/reports" title="Reports" desc="KPIs & history" />
        </nav>
      </SignedIn>
      <SignedOut>
        <p className="text-slate-600">Sign in to continue.</p>
      </SignedOut>
    </main>
  );
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href as never}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="text-lg font-medium">{title}</div>
      <div className="text-sm text-slate-500">{desc}</div>
    </Link>
  );
}
