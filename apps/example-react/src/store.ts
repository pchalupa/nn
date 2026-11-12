import { BroadcastSync } from "@nn/broadcast-sync";
import { IndexDbSync } from "@nn/indexdb-sync";
import { createStore } from "@nn/react";
import { SseSync } from "@nn/sse-sync";
import { schema } from "example-schema";

const { store, useRead, useUpdate } = createStore(schema);

const persistence = new IndexDbSync(store, "example-react");
const broadcast = new BroadcastSync(store, "example-react");
const remote = new SseSync(store, new URL(import.meta.env.VITE_REMOTE_URL, location.origin));

addEventListener("online", () => remote.retry());
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") remote.retry();
});

remote.connect();
broadcast.connect();
persistence.connect();

export { store, useRead, useUpdate };
