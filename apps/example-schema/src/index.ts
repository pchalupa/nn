import { array, enumeration, type InferStateType, number, object, string } from "@nn/schema";

export type Status = InferStateType<typeof status>;

export type Language = InferStateType<typeof language>;

export type Ticket = InferStateType<typeof ticket>;

export type Comment = InferStateType<typeof comment>;

export const status = enumeration("todo", "in-progress", "review", "done");

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

const comment = object({
	id: string(),
	ticketId: string(),
	authorId: string(),
	createdAt: string(),
	body: string(),
	reviewedDescription: string(),
})
	.entitle("comment")
	.describe("A ticket comment and the description its author reviewed.");

export const schema = object({
	users: array(user).describe("List of users"),
	tickets: array(ticket).describe("List of tickets"),
	language,
	tags: array(object({ name: string() })),
	comments: array(comment),
});
