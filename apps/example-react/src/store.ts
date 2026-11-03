import { IndexDbRepository } from "@nn/indexdb-repository";
import { createStore, use } from "@nn/react";
import { RepositorySync } from "@nn/repository-sync";
import { array, enumeration, type InferStateType, number, object, string } from "@nn/schema";

export type Status = InferStateType<typeof status>;

export type Language = InferStateType<typeof language>;

const user = object({
	name: string().describe("User name"),
	email: string(),
})
	.entitle("user")
	.describe("Holds information about a user.");

export const status = enumeration("todo", "in-progress", "done");

export const language = enumeration("en", "cs");

const passkey = object({
	credentialId: string(),
	publicKey: string(),
	algorithm: number(),
})
	.entitle("passkey")
	.describe("Holds the public part of a user's passkey.");

const account = object({
	id: string(),
	name: string().describe("User name"),
	passkeys: array(passkey),
})
	.entitle("account")
	.describe("Holds a registered user and their passkeys.");

const ticket = object({
	id: string(),
	title: string().describe("Ticket description."),
	description: string(),
	status,
	assignee: user,
})
	.entitle("ticket")
	.describe("Holds information about a ticket.");

const tags = array(object({ name: string() }));

const schema = object({
	users: array(account).describe("List of users"),
	tickets: array(ticket).describe("List of tickets"),
	language,
	tags,
});

// TODO: Create store can return hooks useRead and useUpdate too
const store = createStore(schema);
const repository = new IndexDbRepository();

RepositorySync.attach(store, repository);

export const { useRead, useUpdate } = use(store);
