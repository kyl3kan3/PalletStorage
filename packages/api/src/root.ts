import { router } from "./trpc";
import { organizationRouter } from "./router/organization";
import { warehouseRouter } from "./router/warehouse";
import { locationRouter } from "./router/location";
import { productRouter } from "./router/product";
import { palletRouter } from "./router/pallet";
import { inboundRouter } from "./router/inbound";
import { outboundRouter } from "./router/outbound";
import { movementRouter } from "./router/movement";
import { scanRouter } from "./router/scan";
import { quickbooksRouter } from "./router/quickbooks";
import { reportRouter } from "./router/report";
import { cycleCountRouter } from "./router/cycleCount";

export const appRouter = router({
  organization: organizationRouter,
  warehouse: warehouseRouter,
  location: locationRouter,
  product: productRouter,
  pallet: palletRouter,
  inbound: inboundRouter,
  outbound: outboundRouter,
  movement: movementRouter,
  scan: scanRouter,
  quickbooks: quickbooksRouter,
  report: reportRouter,
  cycleCount: cycleCountRouter,
});

export type AppRouter = typeof appRouter;
