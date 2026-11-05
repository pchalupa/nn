import EventEmitter from "events";

import express from "express";

import type { Database } from "../services/db/db";
import logger from "../services/logger";

export default function createSync(db: Database): express.Router {
	const events = new EventEmitter();

	const sync = express.Router();

	sync.post("/push", async (req, res) => {
		try {
			const data = req.body;

			if (!data || typeof data !== "object") res.status(400).json({ error: "No data provided" });
			else {
				await db.update(data);
				logger.info("Data updated:", data);

				res.json(data);
				events.emit("update", data);
			}
		} catch (error) {
			logger.error({ err: error }, "Error pushing data");
			res.status(500).json({ error: "Failed to update data" });
		}
	});

	sync.get("/subscribe", async (req, res) => {
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");

		logger.info("Client connected");

		const send = (fields: Record<string, unknown>) => {
			res.write(`data: ${JSON.stringify(fields)}\n\n`);
		};

		events.addListener("update", send);

		req.once("close", () => {
			logger.info("Client disconnected");
			events.removeListener("update", send);
			res.end();
		});

		try {
			send(await db.get());
		} catch (error) {
			logger.error({ err: error }, "Error sending snapshot");
			events.removeListener("update", send);
			res.end();
		}
	});

	return sync;
}
