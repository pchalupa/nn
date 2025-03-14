import { Repository } from "@nn/repository";

export class LocalStorageRepository<Value> extends Repository<Value> {
	protected store(key: string, value: string): void {
		window.localStorage.setItem(key, value);
	}

	protected retrieve(key: string): string | undefined {
		const item = window.localStorage.getItem(key);

		if (item) return item;
	}
}
