import { IndexDbRepository } from "@nn/indexdb-repository";
import { collection, createStore, use } from "@nn/react";

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
	repository: IndexDbRepository,
	schema: {
		users: collection<User>(),
		projects: collection<Project>(),
		tickets: collection<Ticket>(),
	},
});

export const useStore = use(store);
