import cors from "cors";
import express from "express";

import createSync from "./routes/sync.js";
import type { Database } from "./services/memory-database.js";
import type { EventBus } from "./services/memory-event-bus.js";

export interface ServerOptions {
	streamDuration?: number;
}

export function createServer(db: Database, bus: EventBus, options: ServerOptions = {}): express.Express {
	const server = express();

	server.use(cors());
	server.use(express.json());

	server.use("/sync", createSync(db, bus, options.streamDuration));

	return server;
}
