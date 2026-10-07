import { Schema } from "./Schema";

export class NumberSchema extends Schema<number> {
	public override readonly type = "number" as const;

	public static isNumberSchema(schema: unknown): schema is NumberSchema {
		return schema instanceof NumberSchema;
	}
}
