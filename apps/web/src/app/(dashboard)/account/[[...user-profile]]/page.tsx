"use client";

import { UserProfile } from "@clerk/nextjs";
import { theme } from "~/lib/theme";
import { Card, PageTitle } from "~/components/kit";

/**
 * Account page. We route here from the UserButton's "Manage account"
 * entry (userProfileMode="navigation" + userProfileUrl="/account"
 * on the button) instead of relying on Clerk's modal, which doesn't
 * always render on top of our dashboard chrome.
 *
 * The `[[...user-profile]]` catch-all keeps Clerk's own sub-routes
 * (e.g. /account/security) working inside our layout.
 */
export default function AccountPage() {
  return (
    <div>
      <PageTitle
        eyebrow="You"
        title="Account"
        subtitle="Email, password, connected devices — your personal settings."
      />
      <Card t={theme} padding={0}>
        <UserProfile
          path="/account"
          routing="path"
          appearance={{ elements: { rootBox: "w-full", cardBox: "shadow-none border-0 w-full" } }}
        />
      </Card>
    </div>
  );
}
