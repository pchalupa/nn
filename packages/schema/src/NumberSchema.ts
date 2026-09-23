import { Schema } from "./Schema";

export class NumberSchema extends Schema<number> {
	override readonly type = "number" as const;

	static isNumberSchema(schema: unknown): schema is NumberSchema {
		return schema instanceof NumberSchema;
	}
}
