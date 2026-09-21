import { type Infer, Schema } from "./Schema";

export class ArraySchema<Item extends Schema> extends Schema<Array<Infer<Item>>> {
	override readonly type = "array" as const;

	constructor(public readonly items: Item) {
		super();
	}
}
