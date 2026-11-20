import { Schema } from "./schema";

/** Schema of a boolean. */
export class BooleanSchema extends Schema<boolean> {
	public override readonly type = "boolean" as const;

	public static override is(schema: unknown): schema is BooleanSchema {
		return schema instanceof BooleanSchema;
	}
}
