import { HttpRemote } from "@nn/http-remote";
import { IndexDbRepository } from "@nn/indexdb-repository";
import { createStore, use } from "@nn/react";
import { array, object, string } from "@nn/schema";

const user = object({
	name: string().describe("User name"),
	email: string(),
})
	.identify("user")
	.describe("Holds information about a user.");

const ticket = object({
	title: string(),
	description: string(),
	status: string(),
	assignee: user,
})
	.identify("ticket")
	.describe("Holds information about a ticket.");

const schema = object({
	users: array(user).describe("List of users"),
	tickets: array(ticket).describe("List of tickets"),
});
const remote = new HttpRemote(import.meta.env.VITE_REMOTE_URL);

const store = createStore({
	repository,
	remote,
	schema,
});

export const useStore = use(store);
