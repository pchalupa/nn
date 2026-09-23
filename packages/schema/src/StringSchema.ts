import { Schema } from "./Schema";

export class StringSchema extends Schema<string> {
	override readonly type = "string" as const;

	static isStringSchema(schema: unknown): schema is StringSchema {
		return schema instanceof StringSchema;
	}
}
