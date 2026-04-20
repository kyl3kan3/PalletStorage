import { Stack } from "expo-router";
import { ClerkProvider } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { trpc } from "../src/lib/trpc";

const tokenCache = {
  getToken: (k: string) => SecureStore.getItemAsync(k),
  saveToken: (k: string, v: string) => SecureStore.setItemAsync(k, v),
};

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:3000";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: `${apiUrl}/api/trpc`, transformer: superjson })],
    }),
  );
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Stack />
        </QueryClientProvider>
      </trpc.Provider>
    </ClerkProvider>
  );
}
