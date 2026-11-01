import { type InferStateType, Schema } from "./Schema";

export class ArraySchema<Item extends Schema> extends Schema<Array<InferStateType<Item>>> {
	public override readonly type = "array" as const;

	constructor(public readonly items: Item) {
		super();
	}

	public static override is(schema: unknown): schema is ArraySchema<Schema> {
		return schema instanceof ArraySchema;
	}
}
