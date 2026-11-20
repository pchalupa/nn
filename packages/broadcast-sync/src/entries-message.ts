import { isObject } from "@nn/guards/is-object";
import { isPlainObject } from "@nn/guards/is-plain-object";

/** Message `BroadcastSync` posts on its channel */
export interface EntriesMessage {
	type: "entries";
	entries: Record<string, unknown>;
}

export function isEntriesMessage(value: unknown): value is EntriesMessage {
	return isObject(value) && value.type === "entries" && isPlainObject(value.entries);
}
