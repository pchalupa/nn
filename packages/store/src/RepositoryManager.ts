import type { Repository } from "@nn/repository";

export class RepositoryManager {
	private repositories = new WeakMap<Repository>();

	private async register(repository: Repository) {
		const repo = await repository.createRepository();

		this.repositories.set(repository, repo);
	}

	private includes(repository: Repository): boolean {
		return this.repositories.has(repository);
	}

	async get(repository: Repository) {
		if (!this.includes(repository)) await this.register(repository);

		return this.repositories.get(repository);
	}
}
