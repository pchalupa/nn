import { Schema } from "./schema";

export class BooleanSchema extends Schema<boolean> {
	public override readonly type = "boolean" as const;

	public static override is(schema: unknown): schema is BooleanSchema {
		return schema instanceof BooleanSchema;
	}
}
