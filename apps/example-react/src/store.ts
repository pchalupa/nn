import { BroadcastSync } from "@nn/broadcast-sync";
import { IndexDbSync } from "@nn/indexdb-sync";
import { createStore, use } from "@nn/react";
import { SseSync } from "@nn/sse-sync";
import { schema } from "example-schema";

// TODO: Create store can return hooks useRead and useUpdate too
const store = createStore(schema);

IndexDbSync.attach(store);
BroadcastSync.attach(store);

const sseSync = SseSync.attach(store, new URL(import.meta.env.VITE_REMOTE_URL, location.origin));

addEventListener("online", () => sseSync.retry());
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") sseSync.retry();
});

export const { useRead, useUpdate } = use(store);
