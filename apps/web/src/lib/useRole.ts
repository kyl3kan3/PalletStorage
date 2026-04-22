"use client";

import { trpc } from "./trpc";

export type Role = "admin" | "manager" | "operator";

/**
 * Effective role of the signed-in user in the active org. Prefers the
 * server-side computed role (memberships table, then Clerk) over
 * Clerk's client-side read so things like the test-account admin
 * upgrade take effect on first render.
 */
export function useRole(): Role | null {
  const q = trpc.organization.myRole.useQuery(undefined, {
    staleTime: 60_000, // role doesn't change often; avoid refetch-storms
  });
  return (q.data?.role as Role | undefined) ?? null;
}

export function useIsAdmin(): boolean {
  return useRole() === "admin";
}

export function useIsManager(): boolean {
  const r = useRole();
  return r === "admin" || r === "manager";
}
