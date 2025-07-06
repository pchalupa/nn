import cors from "cors";
import express from "express";
import * as db from "./services/db/db";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/pull", async (_req, res) => {
	try {
		const data = await db.get();

		res.json(data);
	} catch (_error) {
		res.status(500).json({ error: "Failed to fetch data" });
	}
});

app.post("/push", async (req, res) => {
	try {
		const data = req.body;

		if (!data || typeof data !== "object") res.status(400).json({ error: "No data provided" });
		else {
			await db.update(data);

			res.json(data);
		}
	} catch (_error) {
		res.status(500).json({ error: "Failed to update data" });
	}
});

app.listen(process.env.PORT);
