/** State the devtools panel reads and watches. */
export interface Inspectable {
	query<Result>(selector: (state: unknown) => Result): Result;
	onChange(listener: () => void): () => void;
}
