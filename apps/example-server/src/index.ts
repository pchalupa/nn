import { createServer } from "./server";
import { createMemoryDatabase } from "./services/db/db";

createServer(createMemoryDatabase()).listen(process.env.PORT);
