import { BroadcastSync } from "@goodstate/broadcast-sync";
import { IndexDbSync } from "@goodstate/indexdb-sync";
import { createStore } from "@goodstate/react";
import { SseSync } from "@goodstate/sse-sync";
import { schema } from "example-schema";

const { store, useQuery, useMutation } = createStore(schema);

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

export { store, useQuery, useMutation };
