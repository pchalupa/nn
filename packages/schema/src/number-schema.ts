import { Schema } from "./schema";

/** Schema of a number. */
export class NumberSchema extends Schema<number> {
	public override readonly type = "number" as const;

	public static override is(schema: unknown): schema is NumberSchema {
		return schema instanceof NumberSchema;
	}
}
