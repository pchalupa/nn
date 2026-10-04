export type Infer<S> = S extends Schema<infer T> ? T : never;

declare const InferredType: unique symbol;

export abstract class Schema<Type = unknown> {
	declare public readonly [InferredType]: Type;
	public abstract readonly type: "string" | "number" | "boolean" | "object" | "array";
	declare public title?: string;
	declare public description?: string;

	public entitle(title: string): this {
		this.title = title;

		return this;
	}

	public describe(description: string): this {
		this.description = description;

		return this;
	}
}
