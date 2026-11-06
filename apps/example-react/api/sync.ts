import { Redis } from "@upstash/redis";

import { createServer } from "./_server/server.js";
import { createRedisDatabase } from "./_server/services/redis-database.js";
import { createRedisEventBus } from "./_server/services/redis-event-bus.js";

const redis = Redis.fromEnv({ automaticDeserialization: false });

export default createServer(createRedisDatabase(redis), createRedisEventBus(redis), {
	streamDuration: 55_000,
});
