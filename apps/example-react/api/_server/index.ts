import { createServer } from "./server.js";
import { createMemoryDatabase } from "./services/memory-database.js";
import { createMemoryEventBus } from "./services/memory-event-bus.js";

createServer(createMemoryDatabase(), createMemoryEventBus()).listen(process.env.PORT);
