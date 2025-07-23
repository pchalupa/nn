export interface RemoteFactory {
	createRepository(url: string): Promise<Remote>;
}

export interface Remote {
	pull: () => Promise<unknown>;
	push: (data: unknown) => Promise<void>;
	subscribe: () => void;
}
