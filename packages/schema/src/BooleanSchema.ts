import { Schema } from "./Schema";

export class BooleanSchema extends Schema<boolean> {
	public override readonly type = "boolean" as const;

	public static isBooleanSchema(schema: unknown): schema is BooleanSchema {
		return schema instanceof BooleanSchema;
	}
}
