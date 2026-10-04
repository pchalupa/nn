export type Infer<S> = S extends Schema<infer T> ? T : never;

declare const InferredType: unique symbol;

export abstract class Schema<Type = unknown> {
	public declare readonly [InferredType]: Type;
	public abstract readonly type: "string" | "number" | "boolean" | "object" | "array";
	public declare title?: string;
	public declare description?: string;

	public entitle(title: string): this {
		this.title = title;

		return this;
	}

	public describe(description: string): this {
		this.description = description;

		return this;
	}
}
