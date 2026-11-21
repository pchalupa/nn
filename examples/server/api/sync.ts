import { handle } from "@hono/vercel";
import { Redis } from "@upstash/redis";

import { createServer } from "../src/server.js";
import { createRedisDatabase } from "../src/services/database/redis-database.js";
import { createRedisEventBus } from "../src/services/database/redis-event-bus.js";

const namespace = process.env.VERCEL_ENV === "preview" ? "nn-example-preview" : "nn-example";

const redis = Redis.fromEnv({ automaticDeserialization: false });

const server = createServer(createRedisDatabase(redis, namespace), createRedisEventBus(redis, namespace), {
	streamDuration: 55_000,
});

export const GET = handle(server);

export const POST = handle(server);

export const OPTIONS = handle(server);
