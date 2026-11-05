import { createServer } from "./server";
import { createFileDatabase } from "./services/db/db";

if (!process.env.DB_PATH) throw new Error("DB_PATH is not set");

createServer(createFileDatabase(process.env.DB_PATH)).listen(process.env.PORT);
