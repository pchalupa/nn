import { type Schema, createStore, use } from "@nn/react";

const schema: Schema = {
	tickets: [],
};
const store = createStore({ schema });

export const useStore = use(store);
