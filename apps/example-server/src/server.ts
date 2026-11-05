import cors from "cors";
import express from "express";

import createSync from "./routes/sync";
import type { Database } from "./services/db/db";

export function createServer(db: Database): express.Express {
	const server = express();

	server.use(cors());
	server.use(express.json());

	server.use("/sync", createSync(db));

	return server;
}
