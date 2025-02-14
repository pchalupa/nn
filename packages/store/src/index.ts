import type { Schema } from ".";
import { Store } from "./Store";
import { Subscribers } from "./Subscribers";

export function createStore({ schema }: { schema: Schema }) {
	const subscribers = new Subscribers();
	const store = new Store(schema, subscribers);

	return store;
}

export type { Store } from "./Store";
export type { Schema, Selector } from "./types";
