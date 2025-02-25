import { createStore, use } from "@nn/react";
import { InMemoryRepository } from "../../packages/store/src/repository/InMemoryRepository";

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

const repository = new InMemoryRepository();

const store = createStore({
	schema: ({ document, collection }) => ({
		user: document<User>(),
		project: document<Project>(),
		tickets: collection<Ticket>({ repository }),
	}),
});

export const useStore = use(store);
