import { InMemoryRepository } from "@nn/in-memory-repository";
import { createStore, use } from "@nn/react";

type Ticket = {
	id: string;
	title: string;
	description: string;
	status: "todo" | "in-progress" | "done";
	assignee?: User;
};

type User = {
	id: string;
	name: string;
	email: string;
};

type Project = {
	id: string;
	name: string;
};

const store = createStore({
	repositories: [{ alias: "ephemeral", provider: InMemoryRepository, options: {} }],
	schema: ({ document, collection }, { ephemeral }) => ({
		users: collection<User>({ repository: ephemeral }),
		project: document<Project>(),
		tickets: collection<Ticket>({ repository: ephemeral }),
	}),
});

export const useStore = use(store);
