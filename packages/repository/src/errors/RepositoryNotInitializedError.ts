import { RepositoryError } from "./RepositoryError";

export class RepositoryNotInitializedError extends RepositoryError {
	override readonly name = "RepositoryNotInitializedError";
	override readonly message = "Repository is not initialized.";
}
