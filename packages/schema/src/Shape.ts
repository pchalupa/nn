export type Infer<S> = S extends Shape<infer T> ? T : never;

declare const InferredType: unique symbol;

export class Shape<Type = unknown> {
	declare readonly [InferredType]: Type;
	readonly type: "primitive" | "array" | "object" = "primitive";
	protected name?: string;
	protected description?: string;

	identify(name: string): this {
		this.name = name;

		return this;
	}

	describe(description: string): this {
		this.description = description;

		return this;
	}
}

export class ObjectShape<Properties extends Record<string, Shape>> extends Shape<{
	[Key in keyof Properties]: Infer<Properties[Key]>;
}> {
	override readonly type = "object" as const;

	constructor(public readonly properties: Properties) {
		super();
	}
}

export class ArrayShape<Item extends Shape> extends Shape<Array<Infer<Item> & { id: string }>> {
	override readonly type = "array" as const;

	constructor(public readonly items: Item) {
		super();
	}
}
