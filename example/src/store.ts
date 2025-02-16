import { createStore, use } from "@nn/react";

type Ticket = {
	id: string;
	title: string;
	description: string;
	status: "todo" | "in-progress" | "done";
};

const store = createStore({
	schema: ({ collection }) => ({
		tickets: collection<Ticket>(),
	}),
});

export const useStore = use(store);
