import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@wms/api";

export const trpc = createTRPCReact<AppRouter>();
