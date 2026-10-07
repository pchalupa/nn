import { RepositoryError } from "./RepositoryError";

export class RepositoryNotInitializedError extends RepositoryError {
	public override readonly name = "RepositoryNotInitializedError";
	public override readonly message = "Repository is not initialized.";
}
