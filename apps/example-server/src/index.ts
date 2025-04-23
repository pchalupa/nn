import cors from "cors";
import express from "express";
import * as db from "./services/db/db";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/pull", async (_req, res) => {
	const data = await db.get();

	res.json(data);
});

app.post("/push", async (req, res) => {
	const data = req.body;

	await db.update(data);

	res.json(data);
});

app.listen(process.env.PORT);
