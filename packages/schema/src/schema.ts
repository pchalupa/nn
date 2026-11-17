export type InferStateType<FromSchema> = FromSchema extends Schema<infer Type> ? Type : never;

export abstract class Schema<Type = unknown> {
	declare protected readonly inferredType: Type;
	public abstract readonly type: "string" | "number" | "boolean" | "enumeration" | "object" | "array";
	declare public title?: string;
	declare public description?: string;

	public entitle(title: string): this {
		this.title = title;

		return this;
	}

	public describe(description: string): this {
		this.description = description;

		return this;
	}

	public static is(schema: unknown): schema is Schema {
		return schema instanceof Schema;
	}
}
