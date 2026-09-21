import { Schema } from "./Schema";

export class StringSchema extends Schema<string> {
	override readonly type = "string" as const;
}
