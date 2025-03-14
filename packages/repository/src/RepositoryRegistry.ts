import type { Repository } from "./Repository";

export class RepositoryRegistry {
	private repositories = new WeakMap<Repository<unknown>>();

	private register(repository: Repository<unknown>) {
		this.repositories.set(repository, repository.constructor());
	}

	private includes(repository: Repository<unknown>): boolean {
		return this.repositories.has(repository);
	}

	get(repository: Repository<unknown>) {
		if (!this.includes(repository)) this.register(repository);

		return this.repositories.get(repository);
	}
}
