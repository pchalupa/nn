export type InferStateType<FromSchema> = FromSchema extends Schema<infer Type> ? Type : never;

/** Describes the shape of data. */
export abstract class Schema<Type = unknown> {
	declare protected readonly inferredType: Type;
	public abstract readonly type: "string" | "number" | "boolean" | "enumeration" | "object" | "array";
	declare public title?: string;
	declare public description?: string;

	/**
	 * Sets a short name.
	 *
	 * @example
	 * const comment = object({ author: string(), body: string() }).entitle("Ticket comment");
	 */
	public entitle(title: string): this {
		this.title = title;

		return this;
	}

	/**
	 * Sets a longer explanation.
	 *
	 * @example
	 * const assignee = string().describe("User id of the assignee.");
	 */
	public describe(description: string): this {
		this.description = description;

		return this;
	}

	public static is(schema: unknown): schema is Schema {
		return schema instanceof Schema;
	}
}
