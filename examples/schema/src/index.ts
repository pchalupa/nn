import { array, enumeration, type InferStateType, number, object, string } from "@nn/schema";

export type Status = InferStateType<typeof status>;

export type Priority = InferStateType<typeof priority>;

export type Language = InferStateType<typeof language>;

export type Ticket = InferStateType<typeof ticket>;

export type Comment = InferStateType<typeof comment>;

export type Link = InferStateType<typeof link>;

export const status = enumeration("backlog", "todo", "in-progress", "done");

export const priority = enumeration("low", "medium", "high");

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

const comment = object({
	id: string(),
	author: string().describe("User id of the author."),
	createdAt: string(),
	body: string(),
})
	.entitle("comment")
	.describe("A ticket comment.");

const link = object({
	id: string(),
	url: string(),
	title: string().describe("Short name shown instead of the URL."),
})
	.entitle("link")
	.describe("A link attached to a ticket, such as a PR, a commit or a document.");

const ticket = object({
	id: string(),
	title: string().describe("Ticket description."),
	description: string(),
	status,
	priority,
	assignee: string().describe("User id of the assignee."),
	labels: array(string()).describe("Label names."),
	comments: array(comment),
	links: array(link),
})
	.entitle("ticket")
	.describe("Holds information about a ticket.");

export const schema = object({
	users: array(user).describe("List of users"),
	tickets: array(ticket).describe("List of tickets"),
	language,
});
