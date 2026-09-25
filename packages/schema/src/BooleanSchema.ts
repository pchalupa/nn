import { Schema } from "./Schema";

export class BooleanSchema extends Schema<boolean> {
	override readonly type = "boolean" as const;

	static isBooleanSchema(schema: unknown): schema is BooleanSchema {
		return schema instanceof BooleanSchema;
	}
}
