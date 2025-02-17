import { createStore, use } from "@nn/react";

type Ticket = {
	id: string;
	title: string;
	description: string;
	status: "todo" | "in-progress" | "done";
};

type User = {
	id: string;
	name: string;
	email: string;
};

const store = createStore({
	schema: ({ document, collection }) => ({
		user: document<User>(),
		tickets: collection<Ticket>(),
	}),
});

export const useStore = use(store);
