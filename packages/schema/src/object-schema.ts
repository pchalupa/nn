import { type InferStateType, Schema } from "./schema";

export class ObjectSchema<Properties extends Record<string, Schema>> extends Schema<{
	[Key in keyof Properties]: InferStateType<Properties[Key]>;
}> {
	public override readonly type = "object" as const;

	constructor(public readonly properties: Properties) {
		super();
	}

	public static override is(schema: unknown): schema is ObjectSchema<Record<string, Schema>> {
		return schema instanceof ObjectSchema;
	}
}
