import { serve } from "@hono/node-server";

import { createServer } from "./server.js";
import { createMemoryDatabase } from "./services/memory-database.js";
import { createMemoryEventBus } from "./services/memory-event-bus.js";

serve({ fetch: createServer(createMemoryDatabase(), createMemoryEventBus()).fetch, port: Number(process.env.PORT) });
