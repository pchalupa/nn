import { StoreError } from "./StoreError";

export class PathError extends StoreError {
	public override readonly name = "PathError";

	public static invalid(path: readonly string[]): PathError {
		return new PathError(`Invalid store path ${JSON.stringify(path)}. Use entry names, row keys, and map fields.`);
	}

	public static missing(path: readonly string[]): PathError {
		return new PathError(`Cannot update missing row at ${JSON.stringify(path)}. Add rows through their collection.`);
	}
}
