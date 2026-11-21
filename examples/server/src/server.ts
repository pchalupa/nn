import { Hono } from "hono";
import { cors } from "hono/cors";

import createSync from "./routes/sync.js";
import type { Database } from "./services/database/database.js";
import type { EventBus } from "./services/database/memory-event-bus.js";

export interface ServerOptions {
	streamDuration?: number;
}

export function createServer(db: Database, bus: EventBus, options: ServerOptions = {}): Hono {
	const server = new Hono();

	server.use(cors());

	server.route("/sync", createSync(db, bus, options.streamDuration));

	return server;
}
