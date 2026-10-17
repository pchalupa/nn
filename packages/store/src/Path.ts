import type { View } from "./View";

type Draft<Value> = { -readonly [Key in keyof Value]: Draft<Value[Key]> };

export type Recipe<Drafted> = (draft: Drafted) => Drafted;

type KeyedRow<Value> = [Value] extends [ReadonlyArray<infer Item>]
	? Item extends { key: string }
		? Item
		: never
	: never;

type RowDraft<Row extends { key: string }> = {
	-readonly [Key in keyof (Omit<Row, "key"> & { key?: string })]: Draft<Row[Key]>;
};

type DataPath<Value> =
	| readonly []
	| (Value extends readonly unknown[]
			? never
			: Value extends object
				? {
						[Key in keyof Value & string]: readonly [Key, ...DataPath<Value[Key]>];
					}[keyof Value & string]
				: never);

type RootPath<Value> =
	| readonly []
	| ([Value] extends [ReadonlyArray<infer Item>]
			? Item extends { key: string }
				? readonly [string, ...DataPath<Omit<Item, "key">>]
				: never
			: never);

export type Path<Data extends Record<string, unknown>> = {
	[Key in keyof Data & string]: readonly [Key, ...RootPath<Data[Key]>];
}[keyof Data & string];

type DataAt<Value, Segments extends readonly string[]> = Segments extends readonly []
	? Value
	: Segments extends readonly [infer Key extends keyof Value, ...infer Rest extends readonly string[]]
		? DataAt<Value[Key], Rest>
		: never;

export type PathValue<Data, Segments extends readonly string[]> = Segments extends readonly [
	infer Root extends keyof Data,
	string,
	...infer Fields extends readonly string[],
]
	? [KeyedRow<Data[Root]>] extends [never]
		? never
		: View<DataAt<KeyedRow<Data[Root]>, Fields>> | undefined
	: Segments extends readonly [infer Root extends keyof Data]
		? View<Data[Root]>
		: never;

export type PathDraft<Data, Segments extends readonly string[]> = Segments extends readonly [
	infer Root extends keyof Data,
]
	? [KeyedRow<Data[Root]>] extends [never]
		? Draft<Data[Root]>
		: Array<RowDraft<KeyedRow<Data[Root]>>>
	: Segments extends readonly [infer Root extends keyof Data, string, ...infer Fields extends readonly string[]]
		? [KeyedRow<Data[Root]>] extends [never]
			? never
			: Fields extends readonly []
				? RowDraft<KeyedRow<Data[Root]>>
				: Draft<DataAt<KeyedRow<Data[Root]>, Fields>>
		: never;
