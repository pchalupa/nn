import cors from "cors";
import EventEmitter from "events";
import express from "express";
import * as db from "./services/db/db";
import logger from "./services/logger";

const server = express();

server.use(cors());
server.use(express.json());

const eventEmitter = new EventEmitter();

server.get("/pull", async (_req, res) => {
	try {
		const data = await db.get();

		res.json(data);
	} catch (error) {
		logger.error("Error pulling data:", error);
		res.status(500).json({ error: "Failed to fetch data" });
	}
});

server.post("/push", async (req, res) => {
	try {
		const data = req.body;

		if (!data || typeof data !== "object") res.status(400).json({ error: "No data provided" });
		else {
			await db.update(data);
			logger.info("Data updated:", data);

			res.json(data);
			eventEmitter.emit("update");
		}
	} catch (error) {
		logger.error("Error pushing data:", error);
		res.status(500).json({ error: "Failed to update data" });
	}
});

server.get("/subscribe", async (req, res) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	logger.info("Client connected");

	const handleUpdate = () => {
		logger.info("Data updated");
		res.write("data: update\n\n");
	};

	eventEmitter.addListener("update", handleUpdate);

	req.once("close", () => {
		logger.info("Client disconnected");
		eventEmitter.removeListener("update", handleUpdate);
		res.end();
	});
});

server.listen(process.env.PORT);
