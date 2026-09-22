export type Infer<S> = S extends Schema<infer T> ? T : never;

declare const InferredType: unique symbol;

export abstract class Schema<Type = unknown> {
	declare readonly [InferredType]: Type;
	abstract readonly type: "string" | "number" | "boolean" | "object" | "array";
	declare title?: string;
	declare description?: string;

	entitle(title: string): this {
		this.title = title;

		return this;
	}

	describe(description: string): this {
		this.description = description;

		return this;
	}
}
