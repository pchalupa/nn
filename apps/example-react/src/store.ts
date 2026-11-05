import { BroadcastSync } from "@nn/broadcast-sync";
import { IndexDbSync } from "@nn/indexdb-sync";
import { createStore, use } from "@nn/react";
import { array, enumeration, type InferStateType, number, object, string } from "@nn/schema";
import { SseSync } from "@nn/sse-sync";

export type Status = InferStateType<typeof status>;

export type Language = InferStateType<typeof language>;

export const status = enumeration("todo", "in-progress", "done");

export const language = enumeration("en", "cs");

const passkey = object({
	credentialId: string(),
	publicKey: string(),
	algorithm: number(),
})
	.entitle("passkey")
	.describe("Holds the public part of a user's passkey.");

const user = object({
	id: string(),
	name: string().describe("User name"),
	passkeys: array(passkey),
})
	.entitle("user")
	.describe("Holds a registered user and their passkeys.");

const ticket = object({
	id: string(),
	title: string().describe("Ticket description."),
	description: string(),
	status,
	assignee: string().describe("User id of the assignee."),
})
	.entitle("ticket")
	.describe("Holds information about a ticket.");

const tags = array(object({ name: string() }));

const schema = object({
	users: array(user).describe("List of users"),
	tickets: array(ticket).describe("List of tickets"),
	language,
	tags,
});

// TODO: Create store can return hooks useRead and useUpdate too
export const store = createStore(schema);

IndexDbSync.attach(store);
BroadcastSync.attach(store);
SseSync.attach(store, new URL(import.meta.env.VITE_REMOTE_URL));

export const { useRead, useUpdate } = use(store);
