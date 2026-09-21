import { Schema } from "./Schema";

export class NumberSchema extends Schema<number> {
	override readonly type = "number" as const;
}
