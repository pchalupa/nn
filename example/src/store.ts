import { IndexDbRepository } from "@nn/indexdb-repository";
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

const store = createStore(({ collection }) => ({
	users: collection<User>({ repository: IndexDbRepository }),
	projects: collection<Project>({ repository: IndexDbRepository }),
	tickets: collection<Ticket>({ repository: IndexDbRepository }),
}));

export const useStore = use(store);
