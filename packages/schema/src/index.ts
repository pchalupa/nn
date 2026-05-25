import { ArrayShape, ObjectShape, Shape } from "./Shape";

export type { Infer } from "./Shape";
export { ArrayShape, ObjectShape, Shape } from "./Shape";

export type AnyShape = Shape | ArrayShape<Shape> | ObjectShape<Record<string, Shape>>;

export function string(): Shape<string> {
	return new Shape<string>();
}

export function number(): Shape<number> {
	return new Shape<number>();
}

export function boolean(): Shape<boolean> {
	return new Shape<boolean>();
}

export function object<Properties extends Record<string, Shape>>(properties: Properties): ObjectShape<Properties> {
	return new ObjectShape(properties);
}

export function array<Item extends Shape>(items: Item): ArrayShape<Item> {
	return new ArrayShape(items);
}
