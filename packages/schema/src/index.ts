import { ArrayShape, BooleanShape, NumberShape, ObjectShape, type Shape, StringShape } from "./Shape";

export type { Infer, ShapeType } from "./Shape";
export { ArrayShape, BooleanShape, NumberShape, ObjectShape, Shape, StringShape } from "./Shape";

export type AnyShape =
	| StringShape
	| NumberShape
	| BooleanShape
	| ArrayShape<Shape>
	| ObjectShape<Record<string, Shape>>;

export function string(): StringShape {
	return new StringShape();
}

export function number(): NumberShape {
	return new NumberShape();
}

export function boolean(): BooleanShape {
	return new BooleanShape();
}

export function object<Properties extends Record<string, Shape>>(properties: Properties): ObjectShape<Properties> {
	return new ObjectShape(properties);
}

export function array<Item extends Shape>(items: Item): ArrayShape<Item> {
	return new ArrayShape(items);
}
