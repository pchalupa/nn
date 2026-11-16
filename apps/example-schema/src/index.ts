import { array, enumeration, type InferStateType, number, object, string } from "@nn/schema";

export type Status = InferStateType<typeof status>;

export type Language = InferStateType<typeof language>;

export type Ticket = InferStateType<typeof ticket>;

export type Comment = InferStateType<typeof comment>;

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
	createdAt: number().describe("Time the account was created, in milliseconds since the epoch."),
	passkeys: array(passkey),
})
	.entitle("user")
	.describe("Holds a registered user and their passkeys.");

const label = object({ name: string() }).entitle("label").describe("Holds a free-form ticket label.");

const link = object({ id: string(), url: string() })
	.entitle("link")
	.describe("Holds a link to a PR, a commit or a document.");

const comment = object({
	id: string(),
	author: string().describe("User id of the author."),
	body: string(),
	createdAt: number().describe("Time the comment was written, in milliseconds since the epoch."),
})
	.entitle("comment")
	.describe("Holds a comment on a ticket.");

const ticket = object({
	id: string(),
	title: string().describe("Ticket description."),
	description: string(),
	status,
	assignee: string().describe("User id of the assignee."),
	number: number().describe("Sequential number shown as the ticket key."),
	rank: number().describe("Position of the ticket within its column."),
	createdBy: string().describe("User id of the author."),
	labels: array(label),
	links: array(link),
	comments: array(comment),
})
	.entitle("ticket")
	.describe("Holds information about a ticket.");

export const schema = object({
	users: array(user).describe("List of users"),
	tickets: array(ticket).describe("List of tickets"),
	language,
});
