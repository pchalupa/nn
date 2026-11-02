import { Schema } from "./Schema";

export class StringSchema extends Schema<string> {
	public override readonly type = "string" as const;

	public static override is(schema: unknown): schema is StringSchema {
		return schema instanceof StringSchema;
	}
}
