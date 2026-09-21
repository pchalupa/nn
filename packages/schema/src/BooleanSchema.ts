import { Schema } from "./Schema";

export class BooleanSchema extends Schema<boolean> {
	override readonly type = "boolean" as const;
}
