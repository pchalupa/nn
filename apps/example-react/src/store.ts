import { BroadcastSync } from "@nn/broadcast-sync";
import { IndexDbSync } from "@nn/indexdb-sync";
import { createStore, use } from "@nn/react";
import { SseSync } from "@nn/sse-sync";
import { schema } from "example-schema";

// TODO: Create store can return hooks useRead and useUpdate too
const store = createStore(schema);

const persistence = new IndexDbSync(store, "nn-default");
const broadcast = new BroadcastSync(store, "nn-default");
const remote = new SseSync(store, new URL(import.meta.env.VITE_REMOTE_URL, location.origin));

addEventListener("online", () => remote.retry());
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") remote.retry();
});

remote.connect();
broadcast.connect();
persistence.connect();

export const { useRead, useUpdate } = use(store);
