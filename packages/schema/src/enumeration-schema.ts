import { Schema } from "./schema";

export class EnumerationSchema<Literals extends readonly [string, ...string[]]> extends Schema<Literals[number]> {
	public override readonly type = "enumeration" as const;

	public readonly literals: Literals;

	constructor(literals: Literals) {
		super();

		this.literals = literals;
	}

	public static override is(schema: unknown): schema is EnumerationSchema<readonly [string, ...string[]]> {
		return schema instanceof EnumerationSchema;
	}
}
