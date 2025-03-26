import type { Repository, RepositoryFactory } from "@nn/repository";

export class RepositoryManager {
	private repositories = new WeakMap<RepositoryFactory>();

	private async register(repositoryFactory: RepositoryFactory): Promise<void> {
		const repository = await repositoryFactory.createRepository();

		this.repositories.set(repositoryFactory, repository);
	}

	private includes(repositoryFactory: RepositoryFactory): boolean {
		return this.repositories.has(repositoryFactory);
	}

	async get(repositoryFactory: RepositoryFactory): Promise<Repository> {
		if (!this.includes(repositoryFactory)) await this.register(repositoryFactory);

		return this.repositories.get(repositoryFactory);
	}
}
