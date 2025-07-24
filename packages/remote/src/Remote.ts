export interface Remote {
	pull: () => Promise<unknown>;
	push: (data: unknown) => Promise<void>;
	subscribe: () => void;
}
