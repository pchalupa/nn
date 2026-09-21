export type Infer<S> = S extends Schema<infer T> ? T : never;

export type SchemaType = "string" | "number" | "boolean" | "object" | "array";

declare const InferredType: unique symbol;

export abstract class Schema<Type = unknown> {
	declare readonly [InferredType]: Type;
	abstract readonly type: SchemaType;
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

export class StringSchema extends Schema<string> {
	override readonly type = "string" as const;
}

export class NumberSchema extends Schema<number> {
	override readonly type = "number" as const;
}

export class BooleanSchema extends Schema<boolean> {
	override readonly type = "boolean" as const;
}

export class ObjectSchema<Properties extends Record<string, Schema>> extends Schema<{
	[Key in keyof Properties]: Infer<Properties[Key]>;
}> {
	override readonly type = "object" as const;

	constructor(public readonly properties: Properties) {
		super();
	}
}

export class ArraySchema<Item extends Schema> extends Schema<Array<Infer<Item>>> {
	override readonly type = "array" as const;

	constructor(public readonly items: Item) {
		super();
	}
}
