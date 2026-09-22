import { type Infer, Schema } from "./Schema";

export class ObjectSchema<Properties extends Record<string, Schema>> extends Schema<{
	[Key in keyof Properties]: Infer<Properties[Key]>;
}> {
	override readonly type = "object" as const;

	constructor(public readonly properties: Properties) {
		super();
	}
}
