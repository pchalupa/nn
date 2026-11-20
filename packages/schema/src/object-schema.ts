import { type InferStateType, Schema } from "./schema";

/** Schema of an object with a fixed set of properties. */
export class ObjectSchema<Properties extends Record<string, Schema>> extends Schema<{
	[Key in keyof Properties]: InferStateType<Properties[Key]>;
}> {
	public override readonly type = "object" as const;

	public readonly properties: Properties;

	constructor(properties: Properties) {
		super();

		this.properties = properties;
	}

	public static override is(schema: unknown): schema is ObjectSchema<Record<string, Schema>> {
		return schema instanceof ObjectSchema;
	}
}
