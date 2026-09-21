export type Infer<S> = S extends Shape<infer T> ? T : never;

export type ShapeType = "string" | "number" | "boolean" | "object" | "array";

declare const InferredType: unique symbol;

export abstract class Shape<Type = unknown> {
	declare readonly [InferredType]: Type;
	abstract readonly type: ShapeType;
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

export class StringShape extends Shape<string> {
	override readonly type = "string" as const;
}

export class NumberShape extends Shape<number> {
	override readonly type = "number" as const;
}

export class BooleanShape extends Shape<boolean> {
	override readonly type = "boolean" as const;
}

export class ObjectShape<Properties extends Record<string, Shape>> extends Shape<{
	[Key in keyof Properties]: Infer<Properties[Key]>;
}> {
	override readonly type = "object" as const;

	constructor(public readonly properties: Properties) {
		super();
	}
}

export class ArrayShape<Item extends Shape> extends Shape<Array<Infer<Item>>> {
	override readonly type = "array" as const;

	constructor(public readonly items: Item) {
		super();
	}
}
