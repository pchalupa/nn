import { isObject } from "@goodstate/guards/is-object";
import { isPlainObject } from "@goodstate/guards/is-plain-object";

/** Message `BroadcastSync` posts on its channel */
export interface EntriesMessage {
	type: "entries";
	entries: Record<string, unknown>;
}

export function isEntriesMessage(value: unknown): value is EntriesMessage {
	return isObject(value) && value.type === "entries" && isPlainObject(value.entries);
}
