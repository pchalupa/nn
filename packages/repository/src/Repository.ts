import { Catalog } from "./Catalog";

export interface Repository {
	set<Value>(id: string, value: Value): Promise<void>;
	get<Value>(id: string): Promise<Value | undefined>;
	getAll<Value>(): Promise<Value[]>;

	createRepository: () => Promise<void>;
}

export abstract class RepositoryOld<Item> {
	private catalog: Catalog;

	constructor() {
		this.catalog = new Catalog(this.store, this.retrieve);
	}
	/** Store value in the repository */
	protected abstract store(id: string, value: string): void;

	/** Retrieve value from the repository */
	protected abstract retrieve(id: string): string | undefined;

	set(id: string, value: Item, type: string): void {
		const item = JSON.stringify(value);

		this.store(id, item);
		this.catalog.set(id, type);
	}

	get(id: string): Item | undefined {
		const item = this.retrieve(id);

		if (item) {
			const parsed: Item = JSON.parse(item);

			return parsed;
		}
	}
}
