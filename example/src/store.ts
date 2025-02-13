import { createStore, use, type Schema } from '@nn/store';

const schema: Schema = {
	tickets: [],
};
const store = createStore({ schema });

export const useStore = use(store);
