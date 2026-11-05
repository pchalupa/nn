import cors from "cors";
import express from "express";

import sync from "./routes/sync";
import * as db from "./services/db/db";
import logger from "./services/logger";

const server = express();

server.use(cors());
server.use(express.json());

server.use("/sync", sync);

server.post("/reset", async (_req, res) => {
	try {
		await db.reset();

		res.status(204).end();
	} catch (error) {
		logger.error({ err: error }, "Error resetting data");
		res.status(500).json({ error: "Failed to reset data" });
	}
});

server.listen(process.env.PORT);
