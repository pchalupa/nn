import { type InferStateType, Schema } from "./schema";

export class ArraySchema<Item extends Schema> extends Schema<Array<InferStateType<Item>>> {
	public override readonly type = "array" as const;

	public readonly items: Item;

	constructor(items: Item) {
		super();

		this.items = items;
	}

	public static override is(schema: unknown): schema is ArraySchema<Schema> {
		return schema instanceof ArraySchema;
	}
}
