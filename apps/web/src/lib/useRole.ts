"use client";

import { useAuth } from "@clerk/nextjs";
import { trpc } from "./trpc";

export type Role = "admin" | "manager" | "operator";

/**
 * Effective role of the signed-in user in the active org. Prefers
 * the server-side computed role (memberships table, then Clerk) so
 * things like the test-account admin upgrade take effect on first
 * render. Falls back to Clerk's client-side `orgRole` while the
 * tRPC query hasn't resolved yet (initial mount, network blip) so
 * admin users don't see manager-gated UI flash off and on.
 */
export function useRole(): Role | null {
  const q = trpc.organization.myRole.useQuery(undefined, {
    staleTime: 60_000,
  });
  const auth = useAuth();
  const fromServer = q.data?.role as Role | undefined;
  if (fromServer) return fromServer;
  return mapClerkRole(auth.orgRole);
}

function mapClerkRole(role: string | null | undefined): Role | null {
  if (!role) return null;
  if (role === "org:admin" || role === "admin") return "admin";
  if (role === "org:manager" || role === "manager") return "manager";
  // Anything else (org:member, basic_member, etc.) is an operator.
  return "operator";
}

export function useIsAdmin(): boolean {
  return useRole() === "admin";
}

export function useIsManager(): boolean {
  const r = useRole();
  return r === "admin" || r === "manager";
}
