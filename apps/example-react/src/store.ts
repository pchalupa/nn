import { HttpRemote } from "@nn/http-remote";
import { IndexDbRepository } from "@nn/indexdb-repository";
import { createStore, use } from "@nn/react";
import { array, enumeration, type InferStateType, object, string } from "@nn/schema";

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
	users: array(user).describe("List of users"),
	tickets: array(ticket).describe("List of tickets"),
	language,
	tags,
});
const remote = new HttpRemote(import.meta.env.VITE_REMOTE_URL);
const repository = new IndexDbRepository();

// TBD: Can you have multiple stores?
const store = createStore({
	repository,
	remote,
	schema,
});

export const { useRead, useUpdate } = use(store);
