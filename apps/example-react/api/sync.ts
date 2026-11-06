import { handle } from "@hono/vercel";
import { Redis } from "@upstash/redis";

import { createServer } from "./_server/server.js";
import { createRedisDatabase } from "./_server/services/redis-database.js";
import { createRedisEventBus } from "./_server/services/redis-event-bus.js";

const redis = Redis.fromEnv({ automaticDeserialization: false });

const server = createServer(createRedisDatabase(redis), createRedisEventBus(redis), {
	streamDuration: 55_000,
});

export const GET = handle(server);

export const POST = handle(server);

export const OPTIONS = handle(server);
