import { type Infer, Schema } from "./Schema";

export class ArraySchema<Item extends Schema> extends Schema<Array<Infer<Item>>> {
	public override readonly type = "array" as const;

	constructor(public readonly items: Item) {
		super();
	}

	public static isArraySchema(schema: unknown): schema is ArraySchema<Schema> {
		return schema instanceof ArraySchema;
	}
}
